require("dotenv").config();

// Node < 18 has no global fetch/Headers/Request/Response/ReadableStream, and
// Node < 22 has no global WebSocket — all required by @supabase/supabase-js
// (including its realtime sub-client, constructed even though this server
// never uses realtime) and groq-sdk. Polyfill unconditionally so the server
// behaves the same on older Node runtimes as on the latest.
if (typeof fetch === "undefined") {
  if (typeof ReadableStream === "undefined") {
    const { ReadableStream, WritableStream, TransformStream } = require("stream/web");
    Object.assign(globalThis, { ReadableStream, WritableStream, TransformStream });
  }
  const { fetch, Headers, Request, Response } = require("undici");
  Object.assign(globalThis, { fetch, Headers, Request, Response });
}
if (typeof WebSocket === "undefined") {
  globalThis.WebSocket = require("ws");
}

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { extractPdfText } = require("./lib/pdfText");
const {
  norm,
  extractSkills,
  makeActions,
  missingSignals,
  classifySkillsImportance,
  computeScoreBreakdown,
} = require("./lib/scoring");

const { optionalAuth } = require("./middleware/auth");
const { supabaseAdmin } = require("./lib/supabaseAdmin");
const groq = require("./lib/groq");

const app = express();

// Render (and most PaaS hosts) put the app behind a single reverse proxy
// hop that sets X-Forwarded-For. Without this, Express's req.ip resolves
// to the proxy's own address for every request, which collapses the
// per-IP rate limiters below into one shared global bucket instead of
// one per real client.
app.set("trust proxy", 1);

// This is a JSON API with no server-rendered HTML/browser assets, so the
// default CSP (built for HTML pages) has nothing to apply to and only
// risks breaking the API responses themselves; keep the rest of helmet's
// hardened defaults (HSTS, no-sniff, frameguard, etc).
app.use(helmet({ contentSecurityPolicy: false }));

// Render's log stream is the only visibility we have into real traffic —
// one concise line per request (method, path, status, response time) so
// production issues are debuggable after the fact instead of only live in
// a terminal that's no longer attached to anyone.
app.use(morgan("tiny"));

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin === "*" ? "*" : corsOrigin.split(",").map((s) => s.trim()),
    methods: ["GET", "POST"],
  }),
);
app.use(express.json({ limit: "5mb" }));

// AI-backed routes each cost a real Groq API call — cap abuse/runaway cost
// per IP. Deliberately in-memory (fine for a single instance); move to a
// shared store (e.g. redis) if this ever runs multi-instance.
// 60/15min (~4/min sustained) comfortably covers a real user iterating on
// several resume bullets in one sitting plus an /analyze run, while still
// keeping a scripted hammering of the Groq-backed routes well below the
// point where it would run up meaningful API cost.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a few minutes." },
});

// Account deletion is irreversible and worth throttling independently of
// the AI limiter above (it's unauthenticated-reachable in the sense that
// anyone with a valid token can hit it repeatedly).
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a few minutes." },
});

// Multer: keep uploaded PDF in memory + limit file size
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
    fields: 5, // only "jd" is expected alongside the file
    fieldSize: 64 * 1024, // headroom above the 20000-char jd cap enforced below
  },
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/analyze", aiLimiter, optionalAuth, upload.single("resume"), async (req, res) => {
  try {
    console.log("POST /analyze received");
    console.log("file?", !!req.file, "jdLength:", (req.body.jd || "").length);

    const jd = typeof req.body.jd === "string" ? req.body.jd : "";
    // Optional: set by the frontend when the uploaded file came from an
    // already-saved resume (src/features/resumes) or an in-progress Roles
    // reanalysis, so the persisted job_analyses row (below) can be linked
    // back to it. Neither is required for /analyze to function.
    if (req.body.resumeId !== undefined && typeof req.body.resumeId !== "string") {
      return res.status(400).json({ error: "Field 'resumeId' must be a string" });
    }
    if (req.body.roleId !== undefined && typeof req.body.roleId !== "string") {
      return res.status(400).json({ error: "Field 'roleId' must be a string" });
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const resumeId =
      typeof req.body.resumeId === "string" && UUID_RE.test(req.body.resumeId.trim())
        ? req.body.resumeId.trim()
        : null;
    const roleId =
      typeof req.body.roleId === "string" && UUID_RE.test(req.body.roleId.trim())
        ? req.body.roleId.trim()
        : null;

    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Resume PDF is required (field name: resume)" });
    }
    if (req.file.mimetype && req.file.mimetype !== "application/pdf") {
      console.warn("Non-PDF upload rejected:", req.file.mimetype);
      return res.status(400).json({
        error: "Only PDF resumes are supported. Please upload a PDF file.",
      });
    }
    if (norm(jd).length < 20) {
      return res
        .status(400)
        .json({ error: "Job description is too short (field name: jd)" });
    }
    if (jd.length > 20000) {
      return res
        .status(400)
        .json({ error: "Job description is too long (max 20000 characters)" });
    }

    console.log("Parsing PDF bytes:", req.file.buffer.length);

    let resumeText = "";
    let numPages = 0;

    try {
      const data = await extractPdfText(req.file.buffer);
      resumeText = data.text || "";
      numPages = data.numPages || 0;
    } catch (e) {
      console.error("PDF text extraction failed:", e);
      return res
        .status(400)
        .json({ error: "Could not extract text from this PDF." });
    }

    if (resumeText.trim().length < 30) {
      return res.status(400).json({
        error:
          "Resume PDF has little/no extractable text (might be scanned). Save it as a text-based PDF and try again.",
      });
    }

    console.log("PDF parsed. Text length:", resumeText.length);

    const jdSkills = extractSkills(jd);
    const resumeSkills = extractSkills(resumeText);

    const resumeSet = new Set(resumeSkills.map((s) => norm(s)));
    const importanceBySkill = classifySkillsImportance(jd, jdSkills);

    const skills = jdSkills.map((s) => ({
      name: s,
      status: resumeSet.has(norm(s)) ? "hit" : "miss",
      importance: importanceBySkill[s] || "required",
    }));

    // Kept for backward compatibility with existing frontend reads
    // (comparison diffs, saved report snapshots) — unweighted hit ratio
    // across every matched JD skill, required or preferred.
    const hits = skills.filter((x) => x.status === "hit").length;
    const total = Math.max(skills.length, 1);
    const coverage = Math.round((hits / total) * 100);

    const signals = missingSignals(resumeText);

    const { overallScore, breakdown } = computeScoreBreakdown({
      skills,
      resumeText,
      numPages,
      signals,
    });
    // `alignment` stays the top-level "overall score" field existing
    // frontend code already reads (Dashboard, Roles tracker, RoleDetail),
    // but its value now comes from the weighted breakdown below instead of
    // the old flat coverage-minus-penalty calculation.
    const alignment = overallScore;

    const missingSkillNames = skills
      .filter((x) => x.status === "miss")
      .map((x) => x.name);
    const actions = makeActions(missingSkillNames);

    const report = {
      alignment,
      coverage,
      breakdown,
      roleTitle: "Job Alignment",
      skills,
      missingSignals: signals,
      actions,
      meta: {
        jdSkillsCount: jdSkills.length,
        resumeSkillsFound: resumeSkills.length,
        pdfTextLength: resumeText.length,
        pdfPages: numPages,
      },
    };

    // Best-effort AI summary layered on top of the deterministic score above.
    // Never fails the request — /analyze keeps working without a Groq key.
    if (groq.isGroqConfigured) {
      try {
        const aiSummary = await groq.summarizeAlignment(resumeText, jd, report);
        if (aiSummary) report.aiSummary = aiSummary;
      } catch (e) {
        console.warn("[analyze] AI summary skipped:", e.message);
      }
    }

    // Persist this analysis for logged-in users so it can be read back later
    // (Analysis history on /resumes) — fire-and-forget, mirrors the
    // /api/improve-bullet -> resume_improvements pattern above.
    if (req.user && supabaseAdmin) {
      supabaseAdmin
        .from("job_analyses")
        .insert({
          user_id: req.user.id,
          resume_id: resumeId,
          role_id: roleId,
          job_description: jd,
          result: report,
        })
        .then(({ error }) => {
          if (error) console.warn("[analyze] save failed:", error.message);
        });
    }

    return res.json(report);
  } catch (err) {
    console.error("Analyze crashed:", err);
    return res.status(500).json({ error: "Failed to analyze resume" });
  }
});

app.post("/api/improve-bullet", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.bullet !== undefined && typeof req.body.bullet !== "string") {
      return res.status(400).json({ error: "Field 'bullet' must be a string" });
    }
    const bullet = (req.body?.bullet || "").trim();
    if (!bullet) {
      return res.status(400).json({ error: "Field 'bullet' is required" });
    }
    if (bullet.length > 600) {
      return res.status(400).json({ error: "Bullet is too long (max 600 characters)" });
    }

    const result = await groq.improveBullet(bullet);

    if (req.user && supabaseAdmin) {
      supabaseAdmin
        .from("resume_improvements")
        .insert({
          user_id: req.user.id,
          input: bullet,
          improved: result.improved,
          why: result.why,
          stack: result.stack,
          impact: result.impact,
        })
        .then(({ error }) => {
          if (error) console.warn("[improve-bullet] save failed:", error.message);
        });
    }

    return res.json(result);
  } catch (err) {
    console.error("improve-bullet failed:", err);
    // GroqNotConfiguredError's message is a fixed, safe, developer-authored
    // string; anything else (raw upstream/unexpected errors) may echo
    // internal details, so only surface it outside production.
    const safeMessage =
      err.name === "GroqNotConfiguredError" || process.env.NODE_ENV !== "production"
        ? err.message
        : null;
    return res.status(err.statusCode || 500).json({ error: safeMessage || "Failed to improve bullet" });
  }
});

app.post("/api/improve-resume", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.resumeText !== undefined && typeof req.body.resumeText !== "string") {
      return res.status(400).json({ error: "Field 'resumeText' must be a string" });
    }
    if (req.body?.jobDescription !== undefined && typeof req.body.jobDescription !== "string") {
      return res.status(400).json({ error: "Field 'jobDescription' must be a string" });
    }

    const resumeText = (req.body?.resumeText || "").trim();
    const jobDescription = (req.body?.jobDescription || "").trim() || undefined;

    if (resumeText.length < 30) {
      return res.status(400).json({ error: "Field 'resumeText' is required and must have real content" });
    }
    if (resumeText.length > 50000) {
      return res.status(400).json({ error: "Field 'resumeText' is too long (max 50000 characters)" });
    }
    if (jobDescription && jobDescription.length > 20000) {
      return res.status(400).json({ error: "Field 'jobDescription' is too long (max 20000 characters)" });
    }

    const result = await groq.improveResume(resumeText, jobDescription);
    return res.json(result);
  } catch (err) {
    console.error("improve-resume failed:", err);
    const safeMessage =
      err.name === "GroqNotConfiguredError" || process.env.NODE_ENV !== "production"
        ? err.message
        : null;
    return res.status(err.statusCode || 500).json({ error: safeMessage || "Failed to improve resume" });
  }
});

app.post("/api/improve-linkedin", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.text !== undefined && typeof req.body.text !== "string") {
      return res.status(400).json({ error: "Field 'text' must be a string" });
    }
    if (req.body?.section !== undefined && typeof req.body.section !== "string") {
      return res.status(400).json({ error: "Field 'section' must be a string" });
    }
    if (req.body?.targetRole !== undefined && typeof req.body.targetRole !== "string") {
      return res.status(400).json({ error: "Field 'targetRole' must be a string" });
    }

    const text = (req.body?.text || "").trim();
    const section = req.body?.section;
    const targetRole = (req.body?.targetRole || "").trim() || undefined;

    if (section !== "headline" && section !== "about") {
      return res.status(400).json({ error: "Field 'section' must be one of \"headline\" or \"about\"" });
    }
    if (!text) {
      return res.status(400).json({ error: "Field 'text' is required" });
    }
    // A LinkedIn headline is short (~220-char platform limit); an About
    // section is closer in scale to a resume bullet block. Cap each
    // consistently with /api/improve-bullet's 600-char cap rather than
    // inventing a new arbitrary number.
    const maxLength = section === "headline" ? 300 : 600;
    if (text.length > maxLength) {
      return res.status(400).json({ error: `Field 'text' is too long (max ${maxLength} characters)` });
    }
    if (targetRole && targetRole.length > 200) {
      return res.status(400).json({ error: "Field 'targetRole' is too long (max 200 characters)" });
    }

    const result = await groq.improveLinkedInSection(text, section, targetRole);
    return res.json(result);
  } catch (err) {
    console.error("improve-linkedin failed:", err);
    const safeMessage =
      err.name === "GroqNotConfiguredError" || process.env.NODE_ENV !== "production"
        ? err.message
        : null;
    return res.status(err.statusCode || 500).json({ error: safeMessage || "Failed to improve LinkedIn section" });
  }
});

app.post("/api/generate-cover-letter", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.resumeText !== undefined && typeof req.body.resumeText !== "string") {
      return res.status(400).json({ error: "Field 'resumeText' must be a string" });
    }
    if (req.body?.jobDescription !== undefined && typeof req.body.jobDescription !== "string") {
      return res.status(400).json({ error: "Field 'jobDescription' must be a string" });
    }
    if (req.body?.companyName !== undefined && typeof req.body.companyName !== "string") {
      return res.status(400).json({ error: "Field 'companyName' must be a string" });
    }
    if (req.body?.roleTitle !== undefined && typeof req.body.roleTitle !== "string") {
      return res.status(400).json({ error: "Field 'roleTitle' must be a string" });
    }

    const resumeText = (req.body?.resumeText || "").trim();
    const jobDescription = (req.body?.jobDescription || "").trim();
    const companyName = (req.body?.companyName || "").trim() || undefined;
    const roleTitle = (req.body?.roleTitle || "").trim() || undefined;

    if (resumeText.length < 30) {
      return res.status(400).json({ error: "Field 'resumeText' is required and must have real content" });
    }
    if (resumeText.length > 50000) {
      return res.status(400).json({ error: "Field 'resumeText' is too long (max 50000 characters)" });
    }
    if (jobDescription.length < 20) {
      return res.status(400).json({ error: "Field 'jobDescription' is required and must have real content" });
    }
    if (jobDescription.length > 20000) {
      return res.status(400).json({ error: "Field 'jobDescription' is too long (max 20000 characters)" });
    }
    if (companyName && companyName.length > 200) {
      return res.status(400).json({ error: "Field 'companyName' is too long (max 200 characters)" });
    }
    if (roleTitle && roleTitle.length > 200) {
      return res.status(400).json({ error: "Field 'roleTitle' is too long (max 200 characters)" });
    }

    const result = await groq.generateCoverLetter(resumeText, jobDescription, companyName, roleTitle);
    return res.json(result);
  } catch (err) {
    console.error("generate-cover-letter failed:", err);
    const safeMessage =
      err.name === "GroqNotConfiguredError" || process.env.NODE_ENV !== "production"
        ? err.message
        : null;
    return res.status(err.statusCode || 500).json({ error: safeMessage || "Failed to generate cover letter" });
  }
});

app.post("/api/generate-interview-questions", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.jobDescription !== undefined && typeof req.body.jobDescription !== "string") {
      return res.status(400).json({ error: "Field 'jobDescription' must be a string" });
    }
    if (req.body?.companyName !== undefined && typeof req.body.companyName !== "string") {
      return res.status(400).json({ error: "Field 'companyName' must be a string" });
    }
    if (req.body?.roleTitle !== undefined && typeof req.body.roleTitle !== "string") {
      return res.status(400).json({ error: "Field 'roleTitle' must be a string" });
    }

    const jobDescription = (req.body?.jobDescription || "").trim();
    const companyName = (req.body?.companyName || "").trim() || undefined;
    const roleTitle = (req.body?.roleTitle || "").trim() || undefined;

    if (jobDescription.length < 20) {
      return res.status(400).json({ error: "Field 'jobDescription' is required and must have real content" });
    }
    if (jobDescription.length > 20000) {
      return res.status(400).json({ error: "Field 'jobDescription' is too long (max 20000 characters)" });
    }
    if (companyName && companyName.length > 200) {
      return res.status(400).json({ error: "Field 'companyName' is too long (max 200 characters)" });
    }
    if (roleTitle && roleTitle.length > 200) {
      return res.status(400).json({ error: "Field 'roleTitle' is too long (max 200 characters)" });
    }

    const result = await groq.generateInterviewQuestions(jobDescription, companyName, roleTitle);
    return res.json(result);
  } catch (err) {
    console.error("generate-interview-questions failed:", err);
    const safeMessage =
      err.name === "GroqNotConfiguredError" || process.env.NODE_ENV !== "production"
        ? err.message
        : null;
    return res.status(err.statusCode || 500).json({ error: safeMessage || "Failed to generate interview questions" });
  }
});

app.post("/api/interview-feedback", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.question !== undefined && typeof req.body.question !== "string") {
      return res.status(400).json({ error: "Field 'question' must be a string" });
    }
    if (req.body?.answer !== undefined && typeof req.body.answer !== "string") {
      return res.status(400).json({ error: "Field 'answer' must be a string" });
    }
    if (req.body?.jobDescription !== undefined && typeof req.body.jobDescription !== "string") {
      return res.status(400).json({ error: "Field 'jobDescription' must be a string" });
    }

    const question = (req.body?.question || "").trim();
    const answer = (req.body?.answer || "").trim();
    const jobDescription = (req.body?.jobDescription || "").trim() || undefined;

    if (!question) {
      return res.status(400).json({ error: "Field 'question' is required" });
    }
    if (question.length > 1000) {
      return res.status(400).json({ error: "Field 'question' is too long (max 1000 characters)" });
    }
    // An interview answer is spoken/typed on the fly, nowhere near resume- or
    // job-description-sized text — 4000 chars (~700-800 words) comfortably
    // covers even a long, detailed answer while still catching accidental
    // pastes of unrelated documents before spending an API call on them.
    if (answer.length < 10) {
      return res.status(400).json({ error: "Field 'answer' is required and must have real content" });
    }
    if (answer.length > 4000) {
      return res.status(400).json({ error: "Field 'answer' is too long (max 4000 characters)" });
    }
    if (jobDescription && jobDescription.length > 20000) {
      return res.status(400).json({ error: "Field 'jobDescription' is too long (max 20000 characters)" });
    }

    const result = await groq.generateInterviewFeedback(question, answer, jobDescription);
    return res.json(result);
  } catch (err) {
    console.error("interview-feedback failed:", err);
    const safeMessage =
      err.name === "GroqNotConfiguredError" || process.env.NODE_ENV !== "production"
        ? err.message
        : null;
    return res.status(err.statusCode || 500).json({ error: safeMessage || "Failed to generate interview feedback" });
  }
});

app.post("/api/account/delete", accountLimiter, optionalAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Login required" });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Account deletion is not configured on the server" });
  }
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error("account delete failed:", err);
    return res.status(500).json({ error: "Failed to delete account" });
  }
});

app.get("/", (req, res) => {
  res.json({ status: "Ascend API running", version: "1.0" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload rejected: ${err.message}` });
  }
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
