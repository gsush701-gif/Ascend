const { supabaseAdmin } = require("./supabaseAdmin");

/**
 * Fire-and-forget insert into `usage_events` (supabase/migrations/011_usage_events.sql).
 * This is telemetry, not a critical path: it must never throw, never delay
 * the caller (no `await` needed at call sites), and never fail the actual
 * user-facing request if the insert itself fails or Supabase isn't
 * configured (e.g. local dev without a service-role key).
 *
 * Privacy: `metadata` must only ever contain non-sensitive shape info
 * (lengths, booleans, counts) — never resume/JD/answer/cover-letter content.
 * This module doesn't enforce that (callers are responsible), but every
 * call site in this codebase has been written to respect it.
 *
 * @param {object} event
 * @param {string} event.eventType e.g. "ai.improve_bullet", "signup"
 * @param {string|null} [event.userId]
 * @param {object|null} [event.metadata]
 * @param {string|null} [event.aiModel]
 * @param {number|null} [event.aiLatencyMs]
 * @param {string|null} [event.requestId]
 */
function recordUsageEvent(event) {
  if (!supabaseAdmin) return; // no-op when Supabase isn't configured (local dev)

  const row = {
    user_id: event.userId || null,
    event_type: event.eventType,
    metadata: event.metadata || null,
    ai_model: event.aiModel || null,
    ai_latency_ms:
      typeof event.aiLatencyMs === "number" ? Math.round(event.aiLatencyMs) : null,
    request_id: event.requestId || null,
  };

  Promise.resolve(supabaseAdmin.from("usage_events").insert(row)).then(
    ({ error }) => {
      if (error) console.warn("[usageEvents] insert failed:", error.message);
    },
    (err) => {
      console.warn("[usageEvents] insert threw:", err && err.message);
    },
  );
}

module.exports = { recordUsageEvent };
