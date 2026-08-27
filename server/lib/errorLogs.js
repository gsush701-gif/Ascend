// --- Persisted, queryable error log (Admin Dashboard, Phase 7 Task 6) ---
//
// Before this, the only records of a server error were console.error/stdout
// (captured as Render logs, not queryable from inside the app) and Sentry
// IF SENTRY_DSN happens to be configured (server/lib/sentry.js — a genuine
// no-op otherwise). Neither is queryable from the admin dashboard itself, so
// this table exists to give GET /api/admin/system something real to show.
//
// Populated from server/lib/errors.js's `sendError` helper (every response
// with status >= 500 — see the comment there for why 4xx isn't logged here)
// via the service-role client, fire-and-forget, exactly mirroring
// server/lib/usageEvents.js's recordUsageEvent: never throws, never awaited
// by the caller, never allowed to slow down or fail the real error response
// a real user is waiting on.
const { supabaseAdmin } = require("./supabaseAdmin");

/**
 * @param {object} entry
 * @param {string|null} [entry.requestId]
 * @param {string|null} [entry.route] req.path — no query string (may carry
 *   sensitive values), matching requestLogger.js's existing discipline.
 * @param {number} entry.statusCode
 * @param {string|null} [entry.errorCode] one of server/lib/errors.js's ErrorCodes
 * @param {string|null} [entry.message] the same safe, already-sanitized
 *   message the client itself received — never a raw stack trace.
 * @param {string|null} [entry.userId]
 */
function recordErrorLog(entry) {
  if (!supabaseAdmin) return; // no-op when Supabase isn't configured (local dev)

  const row = {
    request_id: entry.requestId || null,
    route: entry.route || null,
    status_code: entry.statusCode,
    error_code: entry.errorCode || null,
    // Defensive cap — this column exists for triage at a glance, not to
    // store arbitrarily large text.
    message: typeof entry.message === "string" ? entry.message.slice(0, 2000) : null,
    user_id: entry.userId || null,
  };

  Promise.resolve(supabaseAdmin.from("error_logs").insert(row)).then(
    ({ error }) => {
      if (error) console.warn("[errorLogs] insert failed:", error.message);
    },
    (err) => {
      console.warn("[errorLogs] insert threw:", err && err.message);
    },
  );
}

module.exports = { recordErrorLog };
