require("dotenv").config();

// Sentry must be required (and initialized) before anything else that could
// throw, so it can observe as much of the process lifecycle as possible.
// Genuinely a no-op (no init, no warning) when SENTRY_DSN isn't set.
const { captureException, isSentryConfigured } = require("./lib/sentry");

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
  computeDetailedAtsAnalysis,
  extractSalary,
} = require("./lib/scoring");

const { optionalAuth } = require("./middleware/auth");
const { requireAdmin } = require("./middleware/requireAdmin");
const { requestId } = require("./middleware/requestId");
const { requestLogger } = require("./middleware/requestLogger");
const { supabaseAdmin, isSupabaseConfigured } = require("./lib/supabaseAdmin");
const { createRateLimiter } = require("./lib/rateLimit");
const { ErrorCodes, sendError } = require("./lib/errors");
const { recordUsageEvent } = require("./lib/usageEvents");
const { checkQuota, enforceUsageQuota } = require("./lib/usage");
const { PLANS, DEFAULT_PLAN, USAGE_LABELS } = require("./lib/plans");
const groq = require("./lib/groq");
const { stripe, isStripeConfigured } = require("./lib/stripe");
const billing = require("./lib/billing");
const { fetchOwnedRow } = require("./lib/supabaseUser");
const { isUuid } = require("./lib/validation");
const { getResumeStoragePathsToDelete } = require("./lib/accountDeletion");
const { computePublicProfileStats, filterPublicProfileFields } = require("./lib/publicProfile");
const { bucketCount, countDistinct, topByCount, computeEventTypeStats } = require("./lib/admin");
const { parsePagination, buildPageResult } = require("./lib/pagination");
const { runWeeklyReportJob } = require("./lib/weeklyReport");
const { sendWeeklyReportEmail } = require("./lib/resend");
const { activeProvider: activeJobProvider, isJobProviderConfigured } = require("./lib/jobProviders");
const { computeJobMatch } = require("./lib/jobMatching");
const crypto = require("crypto");

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

// Stripe's webhook signature check (stripe.webhooks.constructEvent, in the
// route handler below) needs the exact raw request bytes — a JSON-parsed
// and re-serialized body will not reproduce the same signature and every
// event would be rejected as invalid. This route is deliberately registered
// here, BEFORE the app-wide express.json() below, and uses its own
// express.raw() body parser scoped to just this one path. Express runs
// middleware/routes in registration order, and this route's handler always
// sends a response itself (it never calls next()), so for a request to this
// exact path the stack never reaches express.json() below — the global
// json parser genuinely never touches this route's body. Verified directly
// in Phase 4b's manual webhook testing (constructEvent succeeds against a
// live-generated signature), not just assumed from the ordering.
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!isStripeConfigured || !stripe) {
    return res.status(503).send("Billing is not configured on the server");
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[billing webhook] STRIPE_WEBHOOK_SECRET is not set — rejecting request.");
    return res.status(503).send("Webhook is not configured on the server");
  }

  const signature = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error("[billing webhook] signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Every branch below is wrapped so a downstream failure (e.g. the
  // `subscriptions` table not existing yet in an environment where
  // migrations 006+ haven't been applied — see supabase/migrations/012's
  // header comment) is logged rather than left to bubble into a 5xx. Stripe
  // retries non-2xx deliveries on a backoff for days; for a webhook whose
  // whole job is a best-effort DB sync, a stuck retry storm is worse than a
  // logged miss the owner can replay manually from the Stripe dashboard
  // once the underlying issue (e.g. missing migration) is fixed.
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await billing.handleCheckoutSessionCompleted(event.data.object, { stripe, supabaseAdmin });
        break;
      case "customer.subscription.updated":
        await billing.handleSubscriptionUpdated(event.data.object, { supabaseAdmin });
        break;
      case "customer.subscription.deleted":
        await billing.handleSubscriptionDeleted(event.data.object, { supabaseAdmin });
        break;
      default:
        console.log(`[billing webhook] unhandled event type, ignoring: ${event.type}`);
    }
  } catch (err) {
    console.error(`[billing webhook] handler failed for event ${event.type}:`, err);
    captureException(err, { route: req.path, stripeEventType: event.type, stripeEventId: event.id });
  }

  return res.status(200).json({ received: true });
});

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

// GET /api/public-profile/:slug is unauthenticated by design (anyone with a
// link can view a public profile) and cheap (a couple of indexed reads, no
// AI call) — same shape of concern as /api/track above, not the Groq-cost
// concern aiLimiter exists for. Generous enough for legitimate repeat visits
// to the same profile, bounded enough that scripted slug enumeration/scraping
// can't run unbounded.
const publicProfileLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: "Too many requests. Please try again in a few minutes.",
  keyPrefix: "public-profile",
});

// GET /api/jobs/search and GET /api/jobs/recommendations (Phase 7 Task 8) —
// no Groq call (not aiLimiter's concern) and no per-user quota; a couple of
// straightforward reads (or, for search, a no-op provider call today).
// Generous enough for a search/filter UI a user might type into repeatedly.
const jobsLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: "Too many requests. Please try again in a few minutes.",
  keyPrefix: "jobs",
});

// Checkout/portal session creation each make a real Stripe API call; a
// logged-in user has no legitimate reason to hit either more than a
// handful of times in 15 minutes (opening the pricing/billing UI a few
// times while deciding), so this is deliberately tighter than aiLimiter.
const billingLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many requests. Please try again in a few minutes.",
  keyPrefix: "billing",
});

// Admin dashboard routes (Phase 7 Task 6) — reachable only by whoever's
// email is in ADMIN_EMAILS (requireAdmin, below), but still rate-limited
// like every other route in this file rather than assuming "small trusted
// audience" is itself a substitute for abuse protection. Generous enough for
// a dashboard making several requests per page load plus pagination clicks.
const adminLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Too many requests. Please try again in a few minutes.",
  keyPrefix: "admin",
});

// POST /api/cron/send-weekly-reports (Phase 7 Task 7) is protected by
// CRON_SECRET (below), not user auth — this limiter is a second layer, not
// the primary defense: even if a secret ever leaked, this bounds how often
// the batch job (which fans out to every opted-in user) can be re-triggered.
// The real GitHub Actions schedule calls this once a week; generous headroom
// here is only for manual workflow_dispatch testing.
const cronLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many requests. Please try again in a few minutes.",
  keyPrefix: "cron",
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
/** Extracts the raw bearer token from the Authorization header, same parsing
 * `optionalAuth` uses — needed by routes that do an ownership-checked lookup
 * via server/lib/supabaseUser.js's RLS-scoped client, since optionalAuth
 * itself only exposes the verified `req.user`, not the raw token. */
function getBearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

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

// --- Stripe billing (Phase 4b) ---
//
// Both routes below require a logged-in user (same optionalAuth + manual
// req.user check pattern already used by /api/account/delete, rather than a
// separate hard-auth middleware that doesn't otherwise exist in this
// codebase). The webhook route that actually owns writes to `subscriptions`
// lives above, before express.json(), since it needs the raw request body.

app.post("/api/billing/create-checkout-session", billingLimiter, optionalAuth, async (req, res) => {
  if (!req.user) {
    return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
  }
  if (!isStripeConfigured || !stripe) {
    return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Billing is not configured on the server");
  }
  if (!PLANS.pro.stripePriceId) {
    return sendError(
      req,
      res,
      503,
      ErrorCodes.SERVICE_UNAVAILABLE,
      "The Pro plan isn't set up in Stripe yet (run server/scripts/setup-stripe-plans.js).",
    );
  }

  try {
    // Reuse an existing Stripe customer if this user already has one (e.g.
    // a past subscription that was later canceled) rather than letting
    // Stripe mint a second, disconnected customer record for the same
    // person.
    let existingCustomerId = null;
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", req.user.id)
        .maybeSingle();
      existingCustomerId = data?.stripe_customer_id || null;
    }

    const frontendUrl = billing.getFrontendUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PLANS.pro.stripePriceId, quantity: 1 }],
      client_reference_id: req.user.id,
      metadata: { supabase_user_id: req.user.id },
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: req.user.email || undefined }),
      success_url: `${frontendUrl}/profile?checkout=success`,
      cancel_url: `${frontendUrl}/profile?checkout=cancelled`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session failed:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to start checkout");
  }
});

app.post("/api/billing/create-portal-session", billingLimiter, optionalAuth, async (req, res) => {
  if (!req.user) {
    return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
  }
  if (!isStripeConfigured || !stripe) {
    return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Billing is not configured on the server");
  }
  if (!supabaseAdmin) {
    return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Billing is not configured on the server");
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (error || !data?.stripe_customer_id) {
      return sendError(
        req,
        res,
        404,
        ErrorCodes.NOT_FOUND,
        "No billing account found yet — subscribe to Pro first.",
      );
    }

    const frontendUrl = billing.getFrontendUrl();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${frontendUrl}/profile`,
    });

    return res.json({ url: portalSession.url });
  } catch (err) {
    console.error("create-portal-session failed:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to open billing portal");
  }
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
      jobDescriptionText: jd,
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

    // Additive field — regex-only, deterministic, never fabricated. `null`
    // when the JD text doesn't actually mention a salary range.
    const salary = extractSalary(jd);

    const report = {
      alignment,
      coverage,
      breakdown,
      roleTitle: "Job Alignment",
      skills,
      missingSignals: signals,
      actions,
      salary,
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

// Dedicated, deeper ATS compatibility check (Phase 7) — same
// resumeText/jobDescription-as-raw-text input convention as
// /api/improve-resume and /api/generate-cover-letter above, rather than an
// id-based lookup: there is no plain-text column on `resumes` to look up
// (saved resumes store a PDF + optional structured_content JSONB for the
// Resume Editor, not extracted text), so every text-input AI-adjacent route
// in this app already takes the text directly from the client, which
// already has it (freshly extracted from the uploaded PDF, or already in
// the Analyzer's state). `computeDetailedAtsAnalysis` itself is
// deterministic/regex-based (no Groq call) — see server/lib/scoring.js's
// header comment on that function for why this is still quota-gated
// despite that: it's a real compute feature this app provides, metered the
// same as every other feature route, not because of upstream API cost.
//
// This is Ascend's own compatibility analysis, not a simulation of any
// specific real-world ATS's parsing behavior — the response shape and any
// UI built on it should keep framing it that way.
app.post("/api/ats-check", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.resumeText !== undefined && typeof req.body.resumeText !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'resumeText' must be a string");
    }
    if (req.body?.jobDescriptionText !== undefined && typeof req.body.jobDescriptionText !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'jobDescriptionText' must be a string");
    }

    const resumeText = (req.body?.resumeText || "").trim();
    const jobDescriptionText = (req.body?.jobDescriptionText || "").trim();

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
    if (jobDescriptionText.length > 20000) {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Field 'jobDescriptionText' is too long (max 20000 characters)",
      );
    }

    if (!(await enforceUsageQuota(req, res, "ai.ats_check"))) return;

    const result = computeDetailedAtsAnalysis(resumeText, jobDescriptionText);

    // Not routed through callGroq — this never calls Groq, so recording a
    // fabricated ai_model/latency for it would be misleading. Recorded
    // directly instead, same fire-and-forget usage_events insert callGroq
    // uses under the hood.
    recordUsageEvent({
      eventType: "ai.ats_check",
      userId: req.user && req.user.id,
      requestId: req.requestId,
      metadata: { success: true },
    });

    return res.json(result);
  } catch (err) {
    console.error("ats-check failed:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to run ATS check");
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

// --- Phase 6a: skill roadmap, project recommendation, cold email, career
// advice, weekly report summary. All follow the established pattern: an
// optionalAuth + aiLimiter route, a quota check before the Groq call, and
// the same validation/error-response discipline as every other /api/* route
// above.

app.post("/api/skill-roadmap", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.skill !== undefined && typeof req.body.skill !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'skill' must be a string");
    }
    if (req.body?.context !== undefined && typeof req.body.context !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'context' must be a string");
    }

    const skill = (req.body?.skill || "").trim();
    const context = (req.body?.context || "").trim() || undefined;

    if (!skill) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'skill' is required");
    }
    if (skill.length > 200) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'skill' is too long (max 200 characters)");
    }
    if (context && context.length > 500) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'context' is too long (max 500 characters)");
    }

    if (!(await enforceUsageQuota(req, res, "ai.skill_roadmap"))) return;

    const result = await callGroq(req, "ai.skill_roadmap", () => groq.generateSkillRoadmap(skill, context));
    return res.json(result);
  } catch (err) {
    console.error("skill-roadmap failed:", err);
    return respondAiError(req, res, err, "Failed to generate a skill roadmap");
  }
});

app.post("/api/recommend-project", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (req.body?.missingSkills !== undefined && !Array.isArray(req.body.missingSkills)) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'missingSkills' must be an array of strings");
    }
    if (req.body?.resumeText !== undefined && typeof req.body.resumeText !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'resumeText' must be a string");
    }

    const missingSkillsRaw = req.body?.missingSkills || [];
    if (
      missingSkillsRaw.length === 0 ||
      !missingSkillsRaw.every((s) => typeof s === "string" && s.trim().length > 0 && s.length <= 100)
    ) {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Field 'missingSkills' must be a non-empty array of non-empty strings (max 100 characters each)",
      );
    }
    if (missingSkillsRaw.length > 20) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'missingSkills' is too long (max 20 skills)");
    }
    const missingSkills = missingSkillsRaw.map((s) => s.trim());

    const resumeText = (req.body?.resumeText || "").trim() || undefined;
    if (resumeText && resumeText.length > 50000) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'resumeText' is too long (max 50000 characters)");
    }

    if (!(await enforceUsageQuota(req, res, "ai.recommend_project"))) return;

    const result = await callGroq(req, "ai.recommend_project", () => groq.recommendProject(missingSkills, resumeText));
    return res.json(result);
  } catch (err) {
    console.error("recommend-project failed:", err);
    return respondAiError(req, res, err, "Failed to recommend a project");
  }
});

app.post("/api/generate-cold-email", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
    }
    if (req.body?.contactId !== undefined && typeof req.body.contactId !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'contactId' must be a string");
    }
    if (req.body?.roleId !== undefined && typeof req.body.roleId !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'roleId' must be a string");
    }
    if (!isUuid(req.body?.contactId)) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'contactId' must be a valid id");
    }
    if (req.body?.roleId !== undefined && !isUuid(req.body.roleId)) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'roleId' must be a valid id");
    }

    const token = getBearerToken(req);
    const contactId = req.body.contactId.trim();
    const roleId = req.body.roleId ? req.body.roleId.trim() : null;

    const { row: contact, error: contactErr } = await fetchOwnedRow({
      table: "contacts",
      id: contactId,
      userId: req.user.id,
      token,
    });
    if (contactErr) {
      console.error("generate-cold-email: contact lookup failed:", contactErr);
      return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to look up contact");
    }
    if (!contact) {
      return sendError(req, res, 404, ErrorCodes.NOT_FOUND, "Contact not found");
    }

    let role = null;
    if (roleId) {
      const { row, error: roleErr } = await fetchOwnedRow({ table: "roles", id: roleId, userId: req.user.id, token });
      if (roleErr) {
        console.error("generate-cold-email: role lookup failed:", roleErr);
        return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to look up role");
      }
      if (!row) {
        return sendError(req, res, 404, ErrorCodes.NOT_FOUND, "Role not found");
      }
      role = row;
    }

    let profileRow = null;
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("full_name, major, target_role")
        .eq("id", req.user.id)
        .maybeSingle();
      profileRow = data || null;
    }

    if (!(await enforceUsageQuota(req, res, "ai.cold_email"))) return;

    const contactInfo = {
      name: contact.name,
      title: contact.title || undefined,
      company: contact.company || undefined,
      relationship: contact.relationship || undefined,
      source: contact.source || undefined,
    };
    const jobContext = role
      ? {
          company: role.company || undefined,
          roleTitle: role.role || undefined,
          jobDescription: role.job_description || undefined,
        }
      : null;
    const candidateProfile = {
      fullName: profileRow?.full_name || undefined,
      major: profileRow?.major || undefined,
      targetRole: profileRow?.target_role || undefined,
    };

    const result = await callGroq(req, "ai.cold_email", () =>
      groq.generateColdEmail(contactInfo, jobContext, candidateProfile),
    );
    return res.json(result);
  } catch (err) {
    console.error("generate-cold-email failed:", err);
    return respondAiError(req, res, err, "Failed to generate outreach message");
  }
});

app.post("/api/career-advice", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
    }
    if (req.body?.question !== undefined && typeof req.body.question !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'question' must be a string");
    }
    if (req.body?.roleId !== undefined && typeof req.body.roleId !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'roleId' must be a string");
    }

    const question = (req.body?.question || "").trim();
    if (!question) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'question' is required");
    }
    if (question.length > 500) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'question' is too long (max 500 characters)");
    }
    if (req.body?.roleId !== undefined && !isUuid(req.body.roleId)) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'roleId' must be a valid id");
    }

    const token = getBearerToken(req);
    const roleId = req.body?.roleId ? req.body.roleId.trim() : null;

    let role = null;
    if (roleId) {
      const { row, error: roleErr } = await fetchOwnedRow({ table: "roles", id: roleId, userId: req.user.id, token });
      if (roleErr) {
        console.error("career-advice: role lookup failed:", roleErr);
        return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to look up role");
      }
      if (!row) {
        return sendError(req, res, 404, ErrorCodes.NOT_FOUND, "Role not found");
      }
      role = row;
    }

    let profileRow = null;
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("major, target_role")
        .eq("id", req.user.id)
        .maybeSingle();
      profileRow = data || null;
    }

    if (!(await enforceUsageQuota(req, res, "ai.career_advice"))) return;

    // Assembled entirely from real, just-fetched rows — never client-supplied
    // numbers — so the model has no path to inventing a fit score or skill
    // list that isn't this user's actual data.
    const contextLines = [];
    if (profileRow?.target_role) contextLines.push(`Profile target role: ${profileRow.target_role}`);
    if (profileRow?.major) contextLines.push(`Profile major: ${profileRow.major}`);
    if (role) {
      contextLines.push(`Role in question: ${role.role} at ${role.company} (status: ${role.status})`);
      contextLines.push(`This role's fit/alignment score: ${role.alignment}%`);
      const snap = role.report_snapshot;
      if (snap?.skills?.length) {
        const matched = snap.skills.filter((s) => s.status === "hit").map((s) => s.name);
        const missing = snap.skills.filter((s) => s.status === "miss").map((s) => s.name);
        if (matched.length) contextLines.push(`Matched skills: ${matched.join(", ")}`);
        if (missing.length) contextLines.push(`Missing skills: ${missing.join(", ")}`);
      }
      if (snap?.missingSignals?.length) {
        contextLines.push(`Missing resume signals: ${snap.missingSignals.join(", ")}`);
      }
    } else if (roleId) {
      // Shouldn't normally happen (404'd above), kept as a defensive note.
      contextLines.push("(Requested role could not be loaded.)");
    }

    const userContext = contextLines.length > 0 ? contextLines.join("\n") : "(No specific role or profile data available for this question.)";

    const result = await callGroq(req, "ai.career_advice", () => groq.careerAdvice(question, userContext));
    return res.json(result);
  } catch (err) {
    console.error("career-advice failed:", err);
    return respondAiError(req, res, err, "Failed to generate career advice");
  }
});

// Structured Resume Editor (Phase 7, Task 1). Both routes require login
// (same reasoning as generate-cold-email/career-advice above: they operate
// on a specific resume the caller must own) and do an ownership-checked
// lookup via server/lib/supabaseUser.js's fetchOwnedRow — a resumeId
// belonging to another user simply 404s, never leaks a row.
app.post("/api/parse-resume", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
    }
    if (typeof req.body?.resumeId !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'resumeId' must be a string");
    }
    if (!isUuid(req.body.resumeId)) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'resumeId' must be a valid id");
    }

    const token = getBearerToken(req);
    const resumeId = req.body.resumeId.trim();

    const { row: resume, error: resumeErr } = await fetchOwnedRow({
      table: "resumes",
      id: resumeId,
      userId: req.user.id,
      token,
    });
    if (resumeErr) {
      console.error("parse-resume: resume lookup failed:", resumeErr);
      return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to look up resume");
    }
    if (!resume) {
      return sendError(req, res, 404, ErrorCodes.NOT_FOUND, "Resume not found");
    }

    const extractedText = (resume.extracted_text || "").trim();
    if (!extractedText) {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "This resume has no extracted text to parse — try re-uploading the file.",
      );
    }

    if (!(await enforceUsageQuota(req, res, "ai.parse_resume"))) return;

    // Never persisted here — the route returns the parsed structure so the
    // frontend can show it for review before the user chooses to save it
    // (see src/features/resumeEditor/hooks/useResumeEditor.ts).
    const result = await callGroq(req, "ai.parse_resume", () => groq.parseResumeToStructured(extractedText));
    return res.json(result);
  } catch (err) {
    console.error("parse-resume failed:", err);
    return respondAiError(req, res, err, "Failed to parse resume");
  }
});

app.post("/api/resume-suggestions", aiLimiter, optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
    }
    if (typeof req.body?.resumeId !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'resumeId' must be a string");
    }
    if (!isUuid(req.body.resumeId)) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'resumeId' must be a valid id");
    }
    if (req.body?.section !== undefined && typeof req.body.section !== "string") {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'section' must be a string");
    }
    const section = req.body?.section ? req.body.section.trim() : null;
    if (section && !groq.RESUME_SECTIONS.includes(section)) {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        `Field 'section' must be one of: ${groq.RESUME_SECTIONS.join(", ")}`,
      );
    }

    const token = getBearerToken(req);
    const resumeId = req.body.resumeId.trim();

    const { row: resume, error: resumeErr } = await fetchOwnedRow({
      table: "resumes",
      id: resumeId,
      userId: req.user.id,
      token,
    });
    if (resumeErr) {
      console.error("resume-suggestions: resume lookup failed:", resumeErr);
      return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to look up resume");
    }
    if (!resume) {
      return sendError(req, res, 404, ErrorCodes.NOT_FOUND, "Resume not found");
    }
    if (!resume.structured_content) {
      return sendError(
        req,
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "This resume has no structured content yet — parse it first.",
      );
    }

    if (!(await enforceUsageQuota(req, res, "ai.resume_suggestions"))) return;

    const result = await callGroq(req, "ai.resume_suggestions", () =>
      groq.generateResumeSuggestions(resume.structured_content, section),
    );

    // Defensively re-validate the model's own output shape before it ever
    // reaches a database insert — same discipline as every other route that
    // writes AI output to a table (e.g. improve-bullet's resume_improvements
    // insert), just with more fields to check here.
    const rawSuggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];
    const toInsert = rawSuggestions
      .filter(
        (s) =>
          s &&
          typeof s.section === "string" &&
          groq.RESUME_SECTIONS.includes(s.section) &&
          typeof s.proposedText === "string" &&
          s.proposedText.trim().length > 0 &&
          typeof s.reason === "string" &&
          s.reason.trim().length > 0,
      )
      .slice(0, 5)
      .map((s) => ({
        resume_id: resumeId,
        user_id: req.user.id,
        section: s.section,
        original_text: typeof s.originalText === "string" ? s.originalText : null,
        proposed_text: s.proposedText,
        reason: s.reason,
        status: "pending",
      }));

    if (toInsert.length === 0) {
      return res.json({ suggestions: [] });
    }
    if (!supabaseAdmin) {
      return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Database not configured");
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("resume_suggestions")
      .insert(toInsert)
      .select();
    if (insertErr) {
      console.error("resume-suggestions: insert failed:", insertErr);
      return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to save suggestions");
    }

    return res.json({ suggestions: inserted || [] });
  } catch (err) {
    console.error("resume-suggestions failed:", err);
    return respondAiError(req, res, err, "Failed to generate resume suggestions");
  }
});

app.post("/api/report-summary", aiLimiter, optionalAuth, async (req, res) => {
  try {
    const stats = req.body?.stats;
    if (typeof stats !== "object" || stats === null || Array.isArray(stats)) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'stats' must be a JSON object");
    }
    let serialized;
    try {
      serialized = JSON.stringify(stats);
    } catch {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'stats' must be JSON-serializable");
    }
    if (serialized.length > 4000) {
      return sendError(req, res, 400, ErrorCodes.VALIDATION_ERROR, "Field 'stats' is too large");
    }

    if (!(await enforceUsageQuota(req, res, "ai.report_summary"))) return;

    const summary = await callGroq(req, "ai.report_summary", () => groq.summarizeCareerReport(stats));
    return res.json({ summary });
  } catch (err) {
    console.error("report-summary failed:", err);
    return respondAiError(req, res, err, "Failed to generate report summary");
  }
});

app.post("/api/account/delete", accountLimiter, optionalAuth, async (req, res) => {
  if (!req.user) {
    return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
  }
  if (!supabaseAdmin) {
    return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Account deletion is not configured on the server");
  }

  // Every other table with a `user_id` FK (`resumes`, `job_analyses`,
  // `contacts`, `notifications`, `career_goals`, `subscriptions`, plus the
  // original `roles`/`resume_improvements`/`profiles`) has
  // `on delete cascade` to `auth.users`, so deleteUser() below removes those
  // rows automatically at the Postgres level. Storage is NOT covered by that
  // cascade — the PDF files in the `resumes` bucket are a separate system —
  // so we look up and delete those objects first, while the `resumes` rows
  // (and their `storage_path`s) still exist to be read.
  //
  // Order matters: Storage cleanup happens before deleteUser() so a failure
  // here still leaves the rows in place to retry from, rather than deleting
  // the user first and losing the only record of which paths need cleanup.
  try {
    const { data: resumeRows, error: resumesError } = await supabaseAdmin
      .from("resumes")
      .select("storage_path")
      .eq("user_id", req.user.id);

    if (resumesError) {
      // Don't block account deletion on a failure to even list the user's
      // resumes — log loudly so this is noticeable, and proceed anyway.
      console.error(
        `[account-delete] failed to list resumes for storage cleanup (user ${req.user.id}):`,
        resumesError.message,
      );
      captureException(resumesError, { requestId: req.requestId, route: req.path, stage: "list-resumes" });
    } else {
      const paths = getResumeStoragePathsToDelete(resumeRows);
      if (paths.length > 0) {
        const { error: removeError } = await supabaseAdmin.storage.from("resumes").remove(paths);
        if (removeError) {
          // A Storage API hiccup must never block the user's actual account
          // deletion — but it does mean these files are about to become
          // orphaned (their owning DB row is seconds from cascading away),
          // so this is logged as loudly as possible for the owner to catch.
          console.error(
            `[account-delete] ORPHANED STORAGE FILES: failed to delete ${paths.length} resume object(s) ` +
              `for user ${req.user.id} before account deletion. Paths: ${paths.join(", ")}. Error: ${removeError.message}`,
          );
          captureException(removeError, {
            requestId: req.requestId,
            route: req.path,
            stage: "remove-storage-objects",
            userId: req.user.id,
            orphanedPaths: paths,
          });
        }
      }
    }
  } catch (err) {
    console.error(
      `[account-delete] ORPHANED STORAGE FILES: unexpected error during resume storage cleanup for user ${req.user.id}:`,
      err,
    );
    captureException(err, { requestId: req.requestId, route: req.path, stage: "storage-cleanup" });
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

// --- Job Discovery (Phase 7 Task 8) ---
//
// This app has no compliant job-listing data provider configured today (see
// server/lib/jobProviders/ — architecture only, no scraping, no fabricated
// postings). GET /api/jobs/search always calls whatever provider JOB_PROVIDER
// selects (server/lib/jobProviders/index.js); with the shipped default
// (NullJobProvider) that's an empty, `providerConfigured: false` result —
// the frontend renders that as "not connected yet", never as "no results
// matched". GET /api/jobs/recommendations computes real match scores (via
// server/lib/jobMatching.js, reusing server/lib/scoring.js) against whatever
// rows already exist in the shared `jobs` table (009_jobs.sql) — honestly
// empty today, ready the moment real rows exist.
//
// saved_jobs/dismissed_jobs (020_job_discovery.sql) are plain per-user
// RLS-protected tables — every WRITE to them (save, unsave, dismiss, undo
// dismiss) is a direct Supabase client call from the frontend, the same
// pattern this app already uses for `contacts` (src/features/contacts/
// hooks/useContacts.ts) and `roles`; no backend route exists for any of
// that (also required by this server's CORS config, methods restricted to
// GET/POST only, above — there's no DELETE route to add here even if we
// wanted one). The one exception is GET /api/jobs/saved below: rendering a
// saved job's company/title/etc. needs a join against `jobs`, and `jobs`
// has zero RLS policies by design (009_jobs.sql — deny-all for anon/
// authenticated), so that join is only possible server-side.

function parseJobSearchQuery(query) {
  const q = query || {};
  const params = {};
  if (typeof q.keywords === "string" && q.keywords.trim()) params.keywords = q.keywords.trim().slice(0, 200);
  if (typeof q.location === "string" && q.location.trim()) params.location = q.location.trim().slice(0, 200);
  if (typeof q.remoteType === "string" && q.remoteType.trim()) params.remoteType = q.remoteType.trim();
  if (typeof q.sponsorship === "string" && q.sponsorship.trim()) params.sponsorship = q.sponsorship.trim();
  if (typeof q.experienceLevel === "string" && q.experienceLevel.trim()) params.experienceLevel = q.experienceLevel.trim();
  if (typeof q.company === "string" && q.company.trim()) params.company = q.company.trim().slice(0, 200);
  if (typeof q.jobType === "string" && q.jobType.trim()) params.jobType = q.jobType.trim();

  const salaryMin = parseFloat(q.salaryMin);
  if (Number.isFinite(salaryMin) && salaryMin >= 0) params.salaryMin = salaryMin;
  const salaryMax = parseFloat(q.salaryMax);
  if (Number.isFinite(salaryMax) && salaryMax >= 0) params.salaryMax = salaryMax;

  if (typeof q.skills === "string" && q.skills.trim()) {
    params.skills = q.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  const { page, pageSize } = parsePagination(q, { defaultPageSize: 20, maxPageSize: 50 });
  params.page = page;
  params.pageSize = pageSize;
  return params;
}

app.get("/api/jobs/search", jobsLimiter, optionalAuth, async (req, res) => {
  try {
    const params = parseJobSearchQuery(req.query);
    const result = await activeJobProvider.search(params);
    return res.json(result);
  } catch (err) {
    // search() is contractually never supposed to throw (see
    // server/lib/jobProviders/types.js), but this route still fails closed
    // to an honest "not connected" response rather than a 500 if a future
    // real provider implementation slips up.
    console.error("[jobs/search] provider threw unexpectedly:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return res.json({ jobs: [], totalCount: 0, page: 1, pageSize: 20, providerConfigured: isJobProviderConfigured });
  }
});

/** Row -> camelCase MatchJob shape jobMatching.js's computeJobMatch expects. */
function jobRowToMatchJob(row) {
  return {
    title: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    remoteType: row.remote_type ?? undefined,
    sponsorship: row.sponsorship ?? undefined,
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    experienceLevel: row.experience_level ?? undefined,
  };
}

app.get("/api/jobs/recommendations", jobsLimiter, optionalAuth, async (req, res) => {
  if (!req.user) {
    return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
  }
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Database is not configured on the server");
  }

  try {
    const userId = req.user.id;

    const [{ data: profileRow, error: profileError }, { data: resumeRow, error: resumeError }, { data: dismissedRows, error: dismissedError }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("target_role, work_authorization, requires_sponsorship, preferred_locations, remote_preference")
          .eq("id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("resumes")
          .select("extracted_text")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("is_default", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin.from("dismissed_jobs").select("job_id").eq("user_id", userId),
      ]);

    if (profileError) throw profileError;
    if (resumeError) throw resumeError;
    if (dismissedError) throw dismissedError;

    const resumeSkills = resumeRow?.extracted_text ? extractSkills(resumeRow.extracted_text) : [];
    const profile = {
      skills: resumeSkills,
      targetRole: profileRow?.target_role || undefined,
      workAuthorization: profileRow?.work_authorization || undefined,
      requiresSponsorship: profileRow?.requires_sponsorship ?? undefined,
      preferredLocations: profileRow?.preferred_locations || undefined,
      remotePreference: profileRow?.remote_preference || undefined,
    };

    const dismissedJobIds = new Set((dismissedRows || []).map((r) => r.job_id));

    const { page, pageSize } = parsePagination(req.query, { defaultPageSize: 20, maxPageSize: 50 });

    // `jobs` is shared reference data with zero RLS policies (009_jobs.sql)
    // — reading it via the service-role client is the only way any server
    // route ever reads it, same as every other admin-client read in this
    // file. Honestly empty today (no provider has ever written a row here);
    // this query and everything below it is correct against zero rows.
    const { data: jobRows, error: jobsError } = await supabaseAdmin
      .from("jobs")
      .select(
        "id, company, title, description, url, source, location, remote_type, employment_type, salary_min, salary_max, salary_currency, sponsorship, experience_level, posted_at, deadline",
      )
      .order("posted_at", { ascending: false, nullsFirst: false });
    if (jobsError) throw jobsError;

    const candidates = (jobRows || []).filter((row) => !dismissedJobIds.has(row.id));

    const scored = candidates.map((row) => {
      const match = computeJobMatch(profile, jobRowToMatchJob(row));
      return { ...row, match };
    });

    scored.sort((a, b) => {
      const aScore = a.match.overallMatchScore ?? -1;
      const bScore = b.match.overallMatchScore ?? -1;
      return bScore - aScore;
    });

    const total = scored.length;
    const offset = (page - 1) * pageSize;
    const items = scored.slice(offset, offset + pageSize);

    return res.json({
      ...buildPageResult({ page, pageSize, total, items }),
      hasResumeOnFile: Boolean(resumeRow?.extracted_text),
    });
  } catch (err) {
    console.error("jobs/recommendations failed:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to compute job recommendations");
  }
});

// GET /api/jobs/saved — the one read that genuinely can't be a plain
// direct-Supabase call from the frontend (unlike save/unsave/dismiss below,
// which are). `saved_jobs` only stores a `job_id` FK; showing a saved job's
// company/title/etc. means joining against `jobs`, and `jobs` is enabled
// with RLS and deliberately ZERO policies (009_jobs.sql) — a `select`
// there always returns nothing for the anon/authenticated Postgres roles,
// embed or not, by design (that migration's own comment: "When a future
// feature needs client access to this table, add a scoped policy here" —
// this route, not a new client-facing policy, is that access path, so
// `jobs` stays exactly as locked-down as the last audit left it). This
// route only ever reads rows the requesting user already owns a
// `saved_jobs` row for, via the service-role client.
app.get("/api/jobs/saved", jobsLimiter, optionalAuth, async (req, res) => {
  if (!req.user) {
    return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
  }
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Database is not configured on the server");
  }
  try {
    const { data: savedRows, error: savedError } = await supabaseAdmin
      .from("saved_jobs")
      .select("job_id, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    if (savedError) throw savedError;

    const jobIds = (savedRows || []).map((r) => r.job_id);
    if (jobIds.length === 0) {
      return res.json({ items: [] });
    }

    const { data: jobRows, error: jobsError } = await supabaseAdmin
      .from("jobs")
      .select(
        "id, company, title, description, url, source, location, remote_type, employment_type, salary_min, salary_max, salary_currency, sponsorship, experience_level, posted_at, deadline",
      )
      .in("id", jobIds);
    if (jobsError) throw jobsError;

    const jobById = new Map((jobRows || []).map((row) => [row.id, row]));
    const items = (savedRows || [])
      .map((saved) => {
        const job = jobById.get(saved.job_id);
        if (!job) return null; // job row was deleted since being saved
        return { ...job, savedAt: saved.created_at };
      })
      .filter(Boolean);

    return res.json({ items });
  } catch (err) {
    console.error("jobs/saved failed:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to load saved jobs");
  }
});

// --- Public shareable profiles (Phase 7 Task 5) ---
//
// Replaces the old fully client-side share-link mechanism (src/lib/
// shareProfile.ts, deleted): a base64-encoded generate-time snapshot
// embedded in the URL, with no ownership/uniqueness for the slug and no way
// to make a profile private again. `public_profiles` (supabase/migrations/
// 017_public_profiles.sql) now stores only the owner's slug + visibility
// preferences; everything actually displayed is computed live, here,
// server-side, from that user's current `roles` rows using the
// service-role client — the only legitimate way to read across users in
// this codebase, and it's mediated entirely by this one read-only endpoint.
//
// Security-critical property: an existing-but-private slug must respond
// IDENTICALLY to a slug that doesn't exist at all, so a visitor (or a script
// probing slugs) can never learn "this profile exists but is private" as
// distinct from "no such profile". Both cases fall through to the exact same
// sendError(...) call below.
app.get("/api/public-profile/:slug", publicProfileLimiter, async (req, res) => {
  const slug = typeof req.params.slug === "string" ? req.params.slug.trim().toLowerCase() : "";
  const notFound = () => sendError(req, res, 404, ErrorCodes.NOT_FOUND, "Profile not found");

  if (!slug || !supabaseAdmin) {
    return notFound();
  }

  try {
    const { data: profileRow, error: profileError } = await supabaseAdmin
      .from("public_profiles")
      .select("user_id, is_public, show_skills, show_alignment_history, show_target_role")
      .eq("slug", slug)
      .maybeSingle();

    if (profileError) {
      console.error("[public-profile] lookup failed:", profileError.message);
      return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Internal server error");
    }
    // Not found and "found but private" are handled by the exact same
    // response — see the comment above the route.
    if (!profileRow || !profileRow.is_public) {
      return notFound();
    }

    const flags = {
      showSkills: Boolean(profileRow.show_skills),
      showAlignmentHistory: Boolean(profileRow.show_alignment_history),
      showTargetRole: Boolean(profileRow.show_target_role),
    };

    const [rolesResult, profileFieldsResult] = await Promise.all([
      supabaseAdmin
        .from("roles")
        .select("alignment, created_at, updated_at, report_snapshot")
        .eq("user_id", profileRow.user_id),
      flags.showTargetRole
        ? supabaseAdmin.from("profiles").select("target_role").eq("id", profileRow.user_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (rolesResult.error) {
      console.error("[public-profile] roles fetch failed:", rolesResult.error.message);
      return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Internal server error");
    }

    const stats = computePublicProfileStats(rolesResult.data || []);
    const targetRole = profileFieldsResult?.data?.target_role ?? null;
    const fields = filterPublicProfileFields(stats, flags, targetRole);

    // Deliberately whitelist the exact response shape rather than spreading
    // `fields` — makes it structurally impossible for a future field added
    // to `stats`/`fields` to leak into this response without an explicit
    // decision here.
    return res.json({
      slug,
      resumeStrength: fields.resumeStrength,
      ...(fields.skills !== undefined ? { skills: fields.skills } : {}),
      ...(fields.alignmentHistory !== undefined ? { alignmentHistory: fields.alignmentHistory } : {}),
      ...(fields.targetRole !== undefined ? { targetRole: fields.targetRole } : {}),
    });
  } catch (e) {
    console.error("[public-profile] unexpected error:", e);
    captureException(e, { requestId: req.requestId, route: "/api/public-profile/:slug" });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Internal server error");
  }
});

// --- Admin dashboard (Phase 7 Task 6) ---
//
// There is no roles/permissions system anywhere in this app — every route
// below uses `optionalAuth` (to get a verified `req.user`, same as every
// other route in this file) followed by `requireAdmin`
// (server/middleware/requireAdmin.js), which independently re-checks the
// caller's verified email against `ADMIN_EMAILS` on every single request.
// This is the real, server-side security boundary; the frontend's /admin
// route only hides its own nav link for non-admins as a UX nicety and relies
// entirely on the 401/403 these routes actually return.
//
// Pagination convention (established here, since none existed before):
// `?page=<1-indexed>&pageSize=<n>` in, `{ page, pageSize, total, totalPages,
// items }` out — server/lib/pagination.js.

// Cheap admin-access check with zero DB work — used by the frontend purely
// to decide whether to show the "Admin" nav link / render the dashboard
// shell, not as the real enforcement (every route below re-checks
// independently regardless of what this returns).
app.get("/api/admin/whoami", adminLimiter, optionalAuth, requireAdmin, (req, res) => {
  res.json({ isAdmin: true, email: req.user.email });
});

// GET /api/admin/overview — high-level account/subscription health.
//
// "Active users" definition (stated explicitly since there's no single
// obvious one): a user who has at least one `usage_events` row (any event
// type — an AI call, an /api/track product event, etc) in the last 30 days.
// This is the same table/window server/lib/usage.js's monthly-quota counting
// already relies on, so it's consistent with what "usage" means elsewhere in
// this codebase, rather than inventing a second definition (e.g. login
// recency, which this app doesn't even track separately from Supabase Auth's
// own last-sign-in timestamp).
//
// Scale note: the distinct-user count below fetches up to 20,000 `user_id`
// values from `usage_events` in the last 30 days and dedupes in memory
// (Supabase's JS client has no server-side `count(distinct ...)` short of a
// raw SQL RPC, which is out of scope for this pass) — fine at this app's
// current traffic, and the same "lightweight infra now, revisit if it ever
// becomes the bottleneck" judgment already applied to the in-memory rate
// limiter fallback (server/lib/rateLimit.js) and other Phase 3/4 choices.
app.get("/api/admin/overview", adminLimiter, optionalAuth, requireAdmin, async (req, res) => {
  if (!supabaseAdmin) {
    return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Admin data is not configured on the server");
  }
  try {
    const RECENT_SIGNUPS_COUNT = 10;
    // perPage=1 is enough to read the `total` users count off this response
    // (see @supabase/auth-js's GoTrueAdminApi.listUsers — it reports the
    // full total via an x-total-count header regardless of page size).
    const [totalUsersResult, recentUsersResult] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 }),
      // Fetched separately (rather than reusing a single larger page) so a
      // change to RECENT_SIGNUPS_COUNT never has to reconsider the total
      // count call above. 200 is a generous-but-bounded page to sort
      // client-side by created_at — see the caveat below.
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);
    if (totalUsersResult.error) throw totalUsersResult.error;
    if (recentUsersResult.error) throw recentUsersResult.error;

    const totalUsers = totalUsersResult.data.total || 0;
    // Caveat, stated plainly rather than silently: if there are more than
    // 200 total users, this sort only considers the first 200 the Auth API
    // returns for page 1 (its own default order, not guaranteed to be
    // recency) — "recent signups" could theoretically miss a very recent
    // signup if the account base has grown past that. Revisit (e.g. an
    // explicit created_at-sorted admin API call, once available) if/when
    // this app's user count approaches that scale.
    const recentSignups = [...recentUsersResult.data.users]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, RECENT_SIGNUPS_COUNT)
      .map((u) => ({ id: u.id, email: u.email || null, createdAt: u.created_at }));

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentUsageRows, error: usageErr } = await supabaseAdmin
      .from("usage_events")
      .select("user_id")
      .not("user_id", "is", null)
      .gte("created_at", thirtyDaysAgo)
      .limit(20000);
    if (usageErr) throw usageErr;
    const activeUsers = countDistinct((recentUsageRows || []).map((r) => r.user_id));

    const { data: subscriptionRows, error: subsErr } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, status");
    if (subsErr) throw subsErr;
    const byPlan = bucketCount((subscriptionRows || []).map((r) => r.plan));
    const byStatus = bucketCount((subscriptionRows || []).map((r) => r.status));

    return res.json({
      totalUsers,
      activeUsers,
      activeUserWindowDays: 30,
      recentSignups,
      subscriptions: {
        // Rows with no subscription row at all are implicitly "free" per
        // server/lib/plans.js and are NOT counted in either breakdown below
        // — only users with an explicit `subscriptions` row are reflected
        // here, consistently with how server/lib/usage.js treats "no row".
        totalRowsWithSubscription: (subscriptionRows || []).length,
        byPlan,
        byStatus,
      },
    });
  } catch (err) {
    console.error("admin/overview failed:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to load admin overview");
  }
});

// GET /api/admin/applications — the `roles` table (this app's job-application
// tracker; see supabase/schema.sql) from an admin's-eye view: total rows,
// a status breakdown, and a paginated recent list.
app.get("/api/admin/applications", adminLimiter, optionalAuth, requireAdmin, async (req, res) => {
  if (!supabaseAdmin) {
    return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Admin data is not configured on the server");
  }
  try {
    const { page, pageSize, offset } = parsePagination(req.query);

    const { count: total, error: countErr } = await supabaseAdmin
      .from("roles")
      .select("id", { count: "exact", head: true });
    if (countErr) throw countErr;

    // `roles.status` has no CHECK constraint (any authenticated client can
    // write an arbitrary string — a known, separately-tracked gap, see
    // docs/SAAS_AUDIT.md §3/§8) so this bucketing can't assume a fixed
    // enum. Capped at 20,000 rows for the same current-scale reasoning as
    // the active-users count above.
    const { data: statusRows, error: statusErr } = await supabaseAdmin
      .from("roles")
      .select("status")
      .limit(20000);
    if (statusErr) throw statusErr;
    const byStatus = bucketCount((statusRows || []).map((r) => r.status));

    const { data: recentRows, error: recentErr } = await supabaseAdmin
      .from("roles")
      .select("id, user_id, company, role, status, alignment, created_at, updated_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (recentErr) throw recentErr;

    return res.json({
      total: total || 0,
      byStatus,
      recent: buildPageResult({ page, pageSize, total: total || 0, items: recentRows || [] }),
    });
  } catch (err) {
    console.error("admin/applications failed:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to load application data");
  }
});

// GET /api/admin/ai-usage — aggregate usage_events for every "ai.*" event
// type (server/lib/plans.js's limit keys), plus a top-requesters leaderboard.
//
// Error-rate honesty (see server/lib/admin.js's computeEventTypeStats for the
// full explanation): only reliable for event types whose route always
// records success/failure via `callGroq()` — that's every ai.* type except
// `ai.ats_check`, which only records a row on success (see the comment on
// POST /api/ats-check above) and therefore always shows a 0/null error rate
// here regardless of real failures. This is stated in the response itself
// (`errorRateReliable`) rather than left for the frontend to guess.
app.get("/api/admin/ai-usage", adminLimiter, optionalAuth, requireAdmin, async (req, res) => {
  if (!supabaseAdmin) {
    return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Admin data is not configured on the server");
  }
  try {
    let windowDays = parseInt(req.query.days, 10);
    if (!Number.isFinite(windowDays) || windowDays < 1) windowDays = 30;
    windowDays = Math.min(windowDays, 90);
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("usage_events")
      .select("event_type, user_id, metadata")
      .like("event_type", "ai.%")
      .gte("created_at", since)
      // Bounds the query for this pass — see the active-users comment above
      // on GET /api/admin/overview for the same current-scale reasoning.
      .limit(20000);
    if (error) throw error;

    const byEventType = computeEventTypeStats(rows || []);
    const totalAiRequests = (rows || []).length;

    const TOP_USERS_COUNT = 10;
    const top = topByCount(
      (rows || []).map((r) => r.user_id),
      TOP_USERS_COUNT,
    );
    const topUsers = await Promise.all(
      top.map(async ({ key: userId, count }) => {
        let email = null;
        try {
          const { data, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
          if (!userErr && data?.user) email = data.user.email || null;
        } catch {
          // A deleted/unlookupable user shouldn't break the whole response —
          // fall back to just the id.
        }
        return { userId, email, requestCount: count };
      }),
    );

    return res.json({
      windowDays,
      totalAiRequests,
      byEventType,
      errorRateReliable: {
        // See the route comment: every ai.* type is reliable except
        // ai.ats_check, whose failures are never recorded at all.
        note: "errorRatePct is null where no success/failure was ever recorded. ai.ats_check specifically only records successes, so its errorRatePct is not trustworthy even when non-null/0.",
      },
      topUsers,
    });
  } catch (err) {
    console.error("admin/ai-usage failed:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to load AI usage data");
  }
});

// GET /api/admin/billing — aggregate view of the `subscriptions` table.
//
// This reflects webhook-synced Stripe state stored in Postgres (server/
// lib/billing.js's handleCheckoutSessionCompleted/handleSubscriptionUpdated/
// handleSubscriptionDeleted, wired to POST /api/billing/webhook above), NOT
// a live call to the Stripe API — so it's only as fresh as the last
// successfully-processed webhook for each user. A live Stripe API call
// (e.g. for real-time revenue/failed-payment data straight from Stripe)
// would be a reasonable future addition but is out of scope for this pass;
// this table already has what's needed for a reasonable billing overview.
app.get("/api/admin/billing", adminLimiter, optionalAuth, requireAdmin, async (req, res) => {
  if (!supabaseAdmin) {
    return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Admin data is not configured on the server");
  }
  try {
    const { page, pageSize, offset } = parsePagination(req.query);

    const { data: allRows, error: allErr } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, status");
    if (allErr) throw allErr;

    const activeByPlan = bucketCount(
      (allRows || []).filter((r) => r.status === "active").map((r) => r.plan),
    );
    const byPlanStatus = bucketCount((allRows || []).map((r) => `${r.plan}:${r.status}`));

    const { count: total, error: countErr } = await supabaseAdmin
      .from("subscriptions")
      .select("id", { count: "exact", head: true });
    if (countErr) throw countErr;

    const { data: recentRows, error: recentErr } = await supabaseAdmin
      .from("subscriptions")
      .select("id, user_id, plan, status, stripe_customer_id, current_period_end, updated_at")
      .order("updated_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (recentErr) throw recentErr;

    return res.json({
      totalSubscriptionRows: (allRows || []).length,
      activeByPlan,
      byPlanStatus,
      isLiveStripeData: false,
      recent: buildPageResult({ page, pageSize, total: total || 0, items: recentRows || [] }),
    });
  } catch (err) {
    console.error("admin/billing failed:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to load billing data");
  }
});

// GET /api/admin/system — recent server errors, from `error_logs`
// (supabase/migrations/018_error_logs.sql), populated by
// server/lib/errors.js's sendError() for every 5xx response. See that
// migration's header comment: before this table existed, there was no
// queryable error store at all (stdout/Render logs and Sentry-if-configured
// aren't queryable from inside this app).
app.get("/api/admin/system", adminLimiter, optionalAuth, requireAdmin, async (req, res) => {
  if (!supabaseAdmin) {
    return sendError(req, res, 503, ErrorCodes.SERVICE_UNAVAILABLE, "Admin data is not configured on the server");
  }
  try {
    const { page, pageSize, offset } = parsePagination(req.query);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [last24hResult, last7dRowsResult, totalResult, recentResult] = await Promise.all([
      supabaseAdmin.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", oneDayAgo),
      supabaseAdmin.from("error_logs").select("route, status_code").gte("created_at", sevenDaysAgo).limit(20000),
      supabaseAdmin.from("error_logs").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("error_logs")
        .select("id, request_id, route, status_code, error_code, message, user_id, created_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1),
    ]);
    if (last24hResult.error) throw last24hResult.error;
    if (last7dRowsResult.error) throw last7dRowsResult.error;
    if (totalResult.error) throw totalResult.error;
    if (recentResult.error) throw recentResult.error;

    const last7dRows = last7dRowsResult.data || [];
    const TOP_ROUTES_COUNT = 10;

    return res.json({
      errorsLast24h: last24hResult.count || 0,
      errorsLast7d: last7dRows.length,
      byStatusCode7d: bucketCount(last7dRows.map((r) => r.status_code)),
      topRoutes7d: topByCount(last7dRows.map((r) => r.route), TOP_ROUTES_COUNT),
      sentryConfigured: isSentryConfigured,
      recent: buildPageResult({
        page,
        pageSize,
        total: totalResult.count || 0,
        items: recentResult.data || [],
      }),
    });
  } catch (err) {
    console.error("admin/system failed:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to load system data");
  }
});

// POST /api/cron/send-weekly-reports (Phase 7 Task 7) — triggered by the
// scheduled GitHub Actions workflow (.github/workflows/weekly-report.yml),
// not by a logged-in user, so it can't use optionalAuth/requireAdmin (there
// is no user session at all). The real security boundary is a shared
// secret compared with crypto.timingSafeEqual (not `===`, which would leak
// timing information about how many leading bytes matched) against
// CRON_SECRET. Three failure states, checked in order:
//   1. CRON_SECRET isn't configured at all -> 503, and this NEVER falls
//      through to "anyone can trigger it" -- an unset secret disables the
//      route entirely rather than defaulting open.
//   2. Header missing, or present but the wrong length/value -> 401.
//   3. Header matches -> proceeds to run the batch job.
app.post("/api/cron/send-weekly-reports", cronLimiter, async (req, res) => {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    console.warn(
      "[cron] CRON_SECRET is not set — refusing to run POST /api/cron/send-weekly-reports " +
        "(this endpoint is disabled until a secret is configured, never open-by-default).",
    );
    return sendError(
      req,
      res,
      503,
      ErrorCodes.SERVICE_UNAVAILABLE,
      "Scheduled report sending is not configured on the server",
    );
  }

  const providedSecret = req.get("X-Cron-Secret") || "";
  const configuredBuf = Buffer.from(configuredSecret);
  const providedBuf = Buffer.from(providedSecret);
  // timingSafeEqual throws if the two buffers differ in length, so compare
  // lengths first (a length mismatch is itself not a secret-dependent
  // signal — it's just "wrong"), only calling timingSafeEqual once lengths
  // already match to get a constant-time comparison of the actual bytes.
  const matches =
    configuredBuf.length === providedBuf.length && crypto.timingSafeEqual(configuredBuf, providedBuf);
  if (!matches) {
    return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Invalid or missing cron secret");
  }

  if (!supabaseAdmin) {
    return sendError(
      req,
      res,
      503,
      ErrorCodes.SERVICE_UNAVAILABLE,
      "Weekly reports are not configured on the server",
    );
  }

  try {
    const summary = await runWeeklyReportJob({
      supabaseAdmin,
      sendEmail: sendWeeklyReportEmail,
      frontendUrl: billing.getFrontendUrl(),
    });
    console.log(
      `[cron] Weekly reports run: processed=${summary.processed} created=${summary.created} ` +
        `skipped=${summary.skipped} emailed=${summary.emailed} errors=${summary.errors.length}`,
    );
    return res.json({ ok: true, summary });
  } catch (err) {
    console.error("[cron] send-weekly-reports failed:", err);
    captureException(err, { requestId: req.requestId, route: req.path });
    return sendError(req, res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to run weekly report job");
  }
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
