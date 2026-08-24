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
const cors = require("cors");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { extractPdfText } = require("./lib/pdfText");

const { optionalAuth } = require("./middleware/auth");
const { supabaseAdmin } = require("./lib/supabaseAdmin");
const groq = require("./lib/groq");

const app = express();

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
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a few minutes." },
});

// Multer: keep uploaded PDF in memory + limit file size
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// --- Skill dictionary: canonical (lowercase, singular) + patterns to match ---
// One canonical name per concept; patterns can be plural/variants. Output is normalized and deduplicated.
const SKILL_ENTRIES = [
  { canonical: "python", patterns: ["python"] },
  { canonical: "java", patterns: ["java"] },
  { canonical: "javascript", patterns: ["javascript"] },
  { canonical: "typescript", patterns: ["typescript"] },
  { canonical: "c++", patterns: ["c++"] },
  { canonical: "c#", patterns: ["c#"] },
  { canonical: "sql", patterns: ["sql"] },
  { canonical: "rest api", patterns: ["rest api", "rest apis", "api"] },
  { canonical: "node", patterns: ["node", "node.js"] },
  { canonical: "express", patterns: ["express"] },
  { canonical: "react", patterns: ["react"] },
  { canonical: "next.js", patterns: ["next.js", "next js"] },
  { canonical: "aws", patterns: ["aws"] },
  { canonical: "azure", patterns: ["azure"] },
  { canonical: "gcp", patterns: ["gcp"] },
  { canonical: "docker", patterns: ["docker"] },
  { canonical: "kubernetes", patterns: ["kubernetes", "k8s"] },
  { canonical: "git", patterns: ["git"] },
  { canonical: "linux", patterns: ["linux"] },
  {
    canonical: "data structures",
    patterns: ["data structures", "data structure"],
  },
  { canonical: "algorithms", patterns: ["algorithms", "algorithm"] },
  { canonical: "testing", patterns: ["testing", "tests"] },
  { canonical: "pytest", patterns: ["pytest"] },
  { canonical: "jest", patterns: ["jest"] },
  { canonical: "ci/cd", patterns: ["ci/cd", "cicd", "ci cd"] },
];

function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(arr) {
  return [...new Set(arr)];
}

function extractSkills(text) {
  const t = norm(text);
  const hits = [];
  for (const { canonical, patterns } of SKILL_ENTRIES) {
    const matched = patterns.some((p) => {
      const key = norm(p);
      return key.length > 0 && t.includes(key);
    });
    if (matched) hits.push(canonical);
  }
  return unique(hits);
}

function makeActions(missing) {
  const actions = [];
  const m = missing.map((x) => x.toLowerCase());

  if (m.some((x) => x.includes("rest")))
    actions.push("Build one REST API project");
  if (
    m.some((x) => x.includes("aws") || x.includes("azure") || x.includes("gcp"))
  )
    actions.push("Deploy a project to a cloud platform (AWS/Render/Vercel)");
  if (m.some((x) => x.includes("testing")))
    actions.push("Add tests (unit/integration) to one project");
  if (m.some((x) => x.includes("docker")))
    actions.push("Containerize one project with Docker");
  if (m.some((x) => x.includes("sql")))
    actions.push("Add a SQL-backed feature to a project");

  if (actions.length === 0)
    actions.push("Add metrics + impact to 2 strongest bullet points");
  return actions.slice(0, 5);
}

function missingSignals(resumeText) {
  const t = norm(resumeText);
  const signals = [];

  const hasDeploy = [
    "deployed",
    "deployment",
    "vercel",
    "render",
    "aws",
    "azure",
    "gcp",
    "netlify",
  ].some((k) => t.includes(k));
  if (!hasDeploy) signals.push("No deployment/hosting experience mentioned");

  const hasNumbers = /\b\d+(\.\d+)?%?\b/.test(t);
  if (!hasNumbers) signals.push("No quantified impact (numbers/metrics) found");

  const hasGitHub = t.includes("github");
  if (!hasGitHub) signals.push("No GitHub link/mention detected");

  return signals;
}

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/analyze", aiLimiter, upload.single("resume"), async (req, res) => {
  try {
    console.log("POST /analyze received");
    console.log("file?", !!req.file, "jdLength:", (req.body.jd || "").length);

    const jd = req.body.jd || "";

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

    const skills = jdSkills.map((s) => ({
      name: s,
      status: resumeSet.has(norm(s)) ? "hit" : "miss",
    }));

    const hits = skills.filter((x) => x.status === "hit").length;
    const total = Math.max(skills.length, 1);

    const coverage = Math.round((hits / total) * 100);

    const signals = missingSignals(resumeText);
    const penalty = Math.min(signals.length * 5, 15);
    const alignment = Math.max(0, coverage - penalty);

    const missingSkillNames = skills
      .filter((x) => x.status === "miss")
      .map((x) => x.name);
    const actions = makeActions(missingSkillNames);

    const report = {
      alignment,
      coverage,
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

    return res.json(report);
  } catch (err) {
    console.error("Analyze crashed:", err);
    return res.status(500).json({ error: "Failed to analyze resume" });
  }
});

app.post("/api/improve-bullet", aiLimiter, optionalAuth, async (req, res) => {
  try {
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
    return res.status(err.statusCode || 500).json({ error: err.message || "Failed to improve bullet" });
  }
});

app.post("/api/improve-resume", aiLimiter, optionalAuth, async (req, res) => {
  try {
    const resumeText = (req.body?.resumeText || "").trim();
    const jobDescription = (req.body?.jobDescription || "").trim() || undefined;

    if (resumeText.length < 30) {
      return res.status(400).json({ error: "Field 'resumeText' is required and must have real content" });
    }

    const result = await groq.improveResume(resumeText, jobDescription);
    return res.json(result);
  } catch (err) {
    console.error("improve-resume failed:", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Failed to improve resume" });
  }
});

app.post("/api/account/delete", optionalAuth, async (req, res) => {
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
