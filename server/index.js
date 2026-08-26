require("dotenv").config();

// Sentry must be required (and initialized) before anything else that could
// throw, so it can observe as much of the process lifecycle as possible.
// Genuinely a no-op (no init, no warning) when SENTRY_DSN isn't set.
const { captureException } = require("./lib/sentry");

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  captureException(reason instanceof Error ? reason : new Error(String(reason)));
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  captureException(err);
});

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
const multer = require("multer");
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
const { requestId } = require("./middleware/requestId");
const { requestLogger } = require("./middleware/requestLogger");
const { supabaseAdmin } = require("./lib/supabaseAdmin");
const { createRateLimiter } = require("./lib/rateLimit");
const { ErrorCodes, sendError } = require("./lib/errors");
const { recordUsageEvent } = require("./lib/usageEvents");
const { checkQuota, enforceUsageQuota } = require("./lib/usage");
const { PLANS, DEFAULT_PLAN, USAGE_LABELS } = require("./lib/plans");
const groq = require("./lib/groq");

const app = express();

// Render (and most PaaS hosts) put the app behind a single reverse proxy
// hop that sets X-Forwarded-For. Without this, Express's req.ip resolves
// to the proxy's own address for every request, which collapses the
// per-IP rate limiters below into one shared global bucket instead of
// one per real client.
app.set("trust proxy", 1);

// Assign a request id + response header (X-Request-Id) before anything else
// runs, so every log line and every error response for this request can be
// correlated, including ones produced by helmet/cors rejections below.
app.use(requestId);

// This is a JSON API with no server-rendered HTML/browser assets, so the
// default CSP (built for HTML pages) has nothing to apply to and only
// risks breaking the API responses themselves; keep the rest of helmet's
// hardened defaults (HSTS, no-sniff, frameguard, etc).
app.use(helmet({ contentSecurityPolicy: false }));

// Structured, one-JSON-line-per-request log to stdout (Render captures
// stdout as logs already) — request id, user id (once optionalAuth has run
// for routes that use it), method, path, status, duration. Replaces the
// previous morgan("tiny") line with something that can actually answer
// "what happened on this specific user's specific request".
app.use(requestLogger);

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin === "*" ? "*" : corsOrigin.split(",").map((s) => s.trim()),
    methods: ["GET", "POST"],
  }),
);
app.use(express.json({ limit: "5mb" }));

// AI-backed routes each cost a real Groq API call — cap abuse/runaway cost
// per IP. Backed by Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set
// (shared across instances); otherwise falls back to the original in-memory
// express-rate-limit behavior (fine for a single instance). See
// server/lib/rateLimit.js.
// 60/15min (~4/min sustained) comfortably covers a real user iterating on
// several resume bullets in one sitting plus an /analyze run, while still
// keeping a scripted hammering of the Groq-backed routes well below the
// point where it would run up meaningful API cost.
const aiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many requests. Please try again in a few minutes.",
  keyPrefix: "ai",
});

// Account deletion is irreversible and worth throttling independently of
// the AI limiter above (it's unauthenticated-reachable in the sense that
// anyone with a valid token can hit it repeatedly).
const accountLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many requests. Please try again in a few minutes.",
  keyPrefix: "account",
});

// /api/track accepts anonymous, unauthenticated product-analytics events
// (signup, resume_uploaded, etc). Generous limit — it's cheap (one DB
// insert, no AI call) and legitimate usage can fire several of these per
// session — but still bounded so it can't be turned into a free write
// amplification/DoS vector against usage_events.
const trackLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: "Too many requests. Please try again in a few minutes.",
  keyPrefix: "track",
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

// Allowlist of product events the frontend may report via POST /api/track —
// prevents arbitrary/unbounded event_type strings (and by extension
// unbounded metadata shapes) from being written by anyone who can reach the
// endpoint, since it deliberately requires no auth.
const TRACKABLE_EVENT_TYPES = new Set([
  "signup",
  "resume_uploaded",
  "analysis_completed",
  "role_created",
  "cover_letter_generated",
  "interview_started",
]);

/**
 * Runs a Groq-calling function with usage-event instrumentation: records a
 * usage_events row (fire-and-forget, success or failure) with the model
 * name, latency, request id, and requesting user (if any) — never the
 * actual resume/JD/answer content. Rethrows on failure so each route's
 * existing catch/error-response logic is unaffected.
 */
async function callGroq(req, eventType, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    recordUsageEvent({
      eventType,
      userId: req.user && req.user.id,
      aiModel: groq.GROQ_MODEL,
      aiLatencyMs: Date.now() - startedAt,
      requestId: req.requestId,
      metadata: { success: true },
    });
    return result;
  } catch (err) {
    recordUsageEvent({
      eventType,
      userId: req.user && req.user.id,
      aiModel: groq.GROQ_MODEL,
      aiLatencyMs: Date.now() - startedAt,
      requestId: req.requestId,
      metadata: { success: false, errorName: err && err.name },
    });
    throw err;
  }
}

/**
 * Shared error response for every /api/* AI route's catch block. Preserves
 * the existing, already-audited discipline: GroqNotConfiguredError's message
 * is a fixed, developer-authored, safe-to-show string; any other error only
 * echoes err.message outside production. In production, anything that isn't
 * GroqNotConfiguredError falls back to the route's generic message so no
 * raw upstream/unexpected error text ever reaches the client.
 */
function respondAiError(req, res, err, fallbackMessage) {
  captureException(err, { requestId: req.requestId, route: req.path });
  if (err && err.name === "GroqNotConfiguredError") {
    return sendError(req, res, err.statusCode || 503, ErrorCodes.AI_NOT_CONFIGURED, err.message);
  }
  const safeMessage =
    process.env.NODE_ENV !== "production" && err && err.message ? err.message : fallbackMessage;
  return sendError(req, res, (err && err.statusCode) || 500, ErrorCodes.AI_REQUEST_FAILED, safeMessage);
}

app.get("/health", (req, res) => res.json({ ok: true }));

// Static plan/pricing/quota config (server/lib/plans.js is the single source
// of truth) — public, no auth required, nothing user-specific in the
// response. The frontend's Profile page reads this to render actual plan
// limits instead of hardcoded prose. Every user is implicitly on `free`
// until real billing exists, so `defaultPlan` tells the frontend which key
// to show for a logged-in user with no `subscriptions` row.
app.get("/api/plans", (req, res) => {
  res.json({ plans: PLANS, defaultPlan: DEFAULT_PLAN, usageLabels: USAGE_LABELS });
});

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
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'resumeId' must be a string");
    }
    if (req.body.roleId !== undefined && typeof req.body.roleId !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'roleId' must be a string");
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
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Resume PDF is required (field name: resume)");
    }
    if (req.file.mimetype && req.file.mimetype !== "application/pdf") {
      console.warn("Non-PDF upload rejected:", req.file.mimetype);
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Only PDF resumes are supported. Please upload a PDF file.",
      );
    }
    if (norm(jd).length < 20) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Job description is too short (field name: jd)");
    }
    if (jd.length > 20000) {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Job description is too long (max 20000 characters)",
      );
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
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Could not extract text from this PDF.");
    }

    if (resumeText.trim().length < 30) {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Resume PDF has little/no extractable text (might be scanned). Save it as a text-based PDF and try again.",
      );
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
    // Never fails the request — /analyze keeps working without a Groq key,
    // and also keeps working (minus this extra layer) for a logged-in free
    // user who has used up their monthly "ai.analyze_summary" quota: the
    // quota gate here only skips the bonus summary, it never rejects the
    // whole /analyze response, since the deterministic report never touches
    // Groq and shouldn't be blocked by a Groq-specific quota.
    if (groq.isGroqConfigured) {
      try {
        const quota = await checkQuota(req.user && req.user.id, "ai.analyze_summary");
        if (quota.allowed) {
          const aiSummary = await callGroq(req, "ai.analyze_summary", () =>
            groq.summarizeAlignment(resumeText, jd, report),
          );
          if (aiSummary) report.aiSummary = aiSummary;
        } else {
          console.warn("[analyze] AI summary skipped: monthly usage limit reached");
        }
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
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to analyze resume");
  }
});

app.post("/api/improve-bullet", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.bullet !== undefined && typeof req.body.bullet !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'bullet' must be a string");
    }
    const bullet = (req.body?.bullet || "").trim();
    if (!bullet) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'bullet' is required");
    }
    if (bullet.length > 600) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Bullet is too long (max 600 characters)");
    }

    if (!(await enforceUsageQuota(req, res, "ai.improve_bullet"))) return;

    const result = await callGroq(req, "ai.improve_bullet", () => groq.improveBullet(bullet));

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
    return respondAiError(req, res, err, "Failed to improve bullet");
  }
});

app.post("/api/improve-resume", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.resumeText !== undefined && typeof req.body.resumeText !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'resumeText' must be a string");
    }
    if (req.body?.jobDescription !== undefined && typeof req.body.jobDescription !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'jobDescription' must be a string");
    }

    const resumeText = (req.body?.resumeText || "").trim();
    const jobDescription = (req.body?.jobDescription || "").trim() || undefined;

    if (resumeText.length < 30) {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Field 'resumeText' is required and must have real content",
      );
    }
    if (resumeText.length > 50000) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'resumeText' is too long (max 50000 characters)");
    }
    if (jobDescription && jobDescription.length > 20000) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'jobDescription' is too long (max 20000 characters)");
    }

    if (!(await enforceUsageQuota(req, res, "ai.improve_resume"))) return;

    const result = await callGroq(req, "ai.improve_resume", () => groq.improveResume(resumeText, jobDescription));
    return res.json(result);
  } catch (err) {
    console.error("improve-resume failed:", err);
    return respondAiError(req, res, err, "Failed to improve resume");
  }
});

app.post("/api/improve-linkedin", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.text !== undefined && typeof req.body.text !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'text' must be a string");
    }
    if (req.body?.section !== undefined && typeof req.body.section !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'section' must be a string");
    }
    if (req.body?.targetRole !== undefined && typeof req.body.targetRole !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'targetRole' must be a string");
    }

    const text = (req.body?.text || "").trim();
    const section = req.body?.section;
    const targetRole = (req.body?.targetRole || "").trim() || undefined;

    if (section !== "headline" && section !== "about") {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Field \'section\' must be one of "headline" or "about"',
      );
    }
    if (!text) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'text' is required");
    }
    // A LinkedIn headline is short (~220-char platform limit); an About
    // section is closer in scale to a resume bullet block. Cap each
    // consistently with /api/improve-bullet's 600-char cap rather than
    // inventing a new arbitrary number.
    const maxLength = section === "headline" ? 300 : 600;
    if (text.length > maxLength) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, `Field 'text' is too long (max ${maxLength} characters)`);
    }
    if (targetRole && targetRole.length > 200) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'targetRole' is too long (max 200 characters)");
    }

    if (!(await enforceUsageQuota(req, res, "ai.improve_linkedin"))) return;

    const result = await callGroq(req, "ai.improve_linkedin", () =>
      groq.improveLinkedInSection(text, section, targetRole),
    );
    return res.json(result);
  } catch (err) {
    console.error("improve-linkedin failed:", err);
    return respondAiError(req, res, err, "Failed to improve LinkedIn section");
  }
});

app.post("/api/generate-cover-letter", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.resumeText !== undefined && typeof req.body.resumeText !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'resumeText' must be a string");
    }
    if (req.body?.jobDescription !== undefined && typeof req.body.jobDescription !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'jobDescription' must be a string");
    }
    if (req.body?.companyName !== undefined && typeof req.body.companyName !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'companyName' must be a string");
    }
    if (req.body?.roleTitle !== undefined && typeof req.body.roleTitle !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'roleTitle' must be a string");
    }

    const resumeText = (req.body?.resumeText || "").trim();
    const jobDescription = (req.body?.jobDescription || "").trim();
    const companyName = (req.body?.companyName || "").trim() || undefined;
    const roleTitle = (req.body?.roleTitle || "").trim() || undefined;

    if (resumeText.length < 30) {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Field 'resumeText' is required and must have real content",
      );
    }
    if (resumeText.length > 50000) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'resumeText' is too long (max 50000 characters)");
    }
    if (jobDescription.length < 20) {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Field 'jobDescription' is required and must have real content",
      );
    }
    if (jobDescription.length > 20000) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'jobDescription' is too long (max 20000 characters)");
    }
    if (companyName && companyName.length > 200) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'companyName' is too long (max 200 characters)");
    }
    if (roleTitle && roleTitle.length > 200) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'roleTitle' is too long (max 200 characters)");
    }

    if (!(await enforceUsageQuota(req, res, "ai.generate_cover_letter"))) return;

    const result = await callGroq(req, "ai.generate_cover_letter", () =>
      groq.generateCoverLetter(resumeText, jobDescription, companyName, roleTitle),
    );
    return res.json(result);
  } catch (err) {
    console.error("generate-cover-letter failed:", err);
    return respondAiError(req, res, err, "Failed to generate cover letter");
  }
});

app.post("/api/generate-interview-questions", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.jobDescription !== undefined && typeof req.body.jobDescription !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'jobDescription' must be a string");
    }
    if (req.body?.companyName !== undefined && typeof req.body.companyName !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'companyName' must be a string");
    }
    if (req.body?.roleTitle !== undefined && typeof req.body.roleTitle !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'roleTitle' must be a string");
    }

    const jobDescription = (req.body?.jobDescription || "").trim();
    const companyName = (req.body?.companyName || "").trim() || undefined;
    const roleTitle = (req.body?.roleTitle || "").trim() || undefined;

    if (jobDescription.length < 20) {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Field 'jobDescription' is required and must have real content",
      );
    }
    if (jobDescription.length > 20000) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'jobDescription' is too long (max 20000 characters)");
    }
    if (companyName && companyName.length > 200) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'companyName' is too long (max 200 characters)");
    }
    if (roleTitle && roleTitle.length > 200) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'roleTitle' is too long (max 200 characters)");
    }

    if (!(await enforceUsageQuota(req, res, "ai.generate_interview_questions"))) return;

    const result = await callGroq(req, "ai.generate_interview_questions", () =>
      groq.generateInterviewQuestions(jobDescription, companyName, roleTitle),
    );
    return res.json(result);
  } catch (err) {
    console.error("generate-interview-questions failed:", err);
    return respondAiError(req, res, err, "Failed to generate interview questions");
  }
});

app.post("/api/interview-feedback", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.question !== undefined && typeof req.body.question !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'question' must be a string");
    }
    if (req.body?.answer !== undefined && typeof req.body.answer !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'answer' must be a string");
    }
    if (req.body?.jobDescription !== undefined && typeof req.body.jobDescription !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'jobDescription' must be a string");
    }

    const question = (req.body?.question || "").trim();
    const answer = (req.body?.answer || "").trim();
    const jobDescription = (req.body?.jobDescription || "").trim() || undefined;

    if (!question) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'question' is required");
    }
    if (question.length > 1000) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'question' is too long (max 1000 characters)");
    }
    // An interview answer is spoken/typed on the fly, nowhere near resume- or
    // job-description-sized text — 4000 chars (~700-800 words) comfortably
    // covers even a long, detailed answer while still catching accidental
    // pastes of unrelated documents before spending an API call on them.
    if (answer.length < 10) {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Field 'answer' is required and must have real content",
      );
    }
    if (answer.length > 4000) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'answer' is too long (max 4000 characters)");
    }
    if (jobDescription && jobDescription.length > 20000) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'jobDescription' is too long (max 20000 characters)");
    }

    if (!(await enforceUsageQuota(req, res, "ai.interview_feedback"))) return;

    const result = await callGroq(req, "ai.interview_feedback", () =>
      groq.generateInterviewFeedback(question, answer, jobDescription),
    );
    return res.json(result);
  } catch (err) {
    console.error("interview-feedback failed:", err);
    return respondAiError(req, res, err, "Failed to generate interview feedback");
  }
});

app.post("/api/account/delete", accountLimiter, optionalAuth, async (req, res) => {
  if (!req.user) {
    return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
  }
  if (!supabaseAdmin) {
    return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Account deletion is not configured on the server");
  }
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error("account delete failed:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to delete account");
  }
});

// Minimal product-analytics sink for the frontend's logEvent() helper
// (src/lib/analytics.ts). No auth — anonymous events (e.g. a pre-signup
// resume upload) are valid and expected. event_type is checked against a
// fixed allowlist so this can't be used to write arbitrary event types or
// otherwise-shaped rows; metadata is stored as-is but the frontend helper is
// written to only ever send small, non-sensitive shape info.
app.post("/api/track", trackLimiter, optionalAuth, async (req, res) => {
  const eventType = req.body?.event_type;
  if (typeof eventType !== "string" || !TRACKABLE_EVENT_TYPES.has(eventType)) {
    return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'event_type' must be one of the recognized event types");
  }

  let metadata = null;
  if (req.body?.metadata !== undefined) {
    if (
      typeof req.body.metadata !== "object" ||
      req.body.metadata === null ||
      Array.isArray(req.body.metadata)
    ) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'metadata' must be a JSON object");
    }
    // Cap size defensively — this is meant to carry a couple of small,
    // non-sensitive fields (e.g. { length: 412 }), not arbitrary payloads.
    let serialized;
    try {
      serialized = JSON.stringify(req.body.metadata);
    } catch {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'metadata' must be JSON-serializable");
    }
    if (serialized.length > 2000) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'metadata' is too large");
    }
    metadata = req.body.metadata;
  }

  recordUsageEvent({
    eventType,
    userId: req.user && req.user.id,
    metadata,
    requestId: req.requestId,
  });

  return res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.json({ status: "Ascend API running", version: "1.0" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  captureException(err, { requestId: req.requestId, route: req.path });
  if (err instanceof multer.MulterError) {
    return sendError(req, res, 400, ErrorCodes.UPLOAD_REJECTED, `Upload rejected: ${err.message}`);
  }
  return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Internal server error");
});

// 404 handler
app.use((req, res) => {
  return sendError(req, res, 404, ErrorCodes.NOT_FOUND, "Route not found");
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
