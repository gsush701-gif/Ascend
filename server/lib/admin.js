// --- Admin Dashboard aggregation helpers (Phase 7 Task 6) ---
//
// Pure, side-effect-free functions over already-fetched rows, mirroring the
// established pattern in this codebase (server/lib/scoring.js,
// server/lib/publicProfile.js, server/lib/usage.js) of keeping anything
// worth unit-testing out of the route handlers themselves. Nothing here
// touches Supabase directly.

/**
 * The real, server-side admin-access check. There is no roles/permissions
 * table anywhere in this app (confirmed: no `is_admin` column, no `roles`
 * concept beyond the unrelated job-tracker `roles` table) — this is
 * deliberately the simplest mechanism that's still a real security boundary:
 * an exact, case-insensitive match against a comma-separated allowlist of
 * real email addresses, read from `ADMIN_EMAILS`. The caller (
 * server/middleware/requireAdmin.js) is responsible for only ever passing in
 * the verified email from `req.user` (set by `optionalAuth` from a
 * Supabase-verified JWT) — this function itself has no way to know whether
 * its `email` argument came from a trustworthy source, so that discipline
 * lives at the call site, not here.
 *
 * @param {string | null | undefined} email
 * @param {string | null | undefined} adminEmailsCsv raw `ADMIN_EMAILS` env value
 * @returns {boolean}
 */
function isAdminEmail(email, adminEmailsCsv) {
  if (!email || typeof email !== "string") return false;
  if (!adminEmailsCsv || typeof adminEmailsCsv !== "string") return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const allowlist = adminEmailsCsv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(normalized);
}

/**
 * Counts occurrences of each distinct value of `values`, e.g. bucketing
 * `subscriptions.status` or `roles.status` for a breakdown. Nullish values
 * are grouped under `"unknown"` rather than dropped, so the counts always
 * sum to `values.length`.
 * @param {Array<string | null | undefined>} values
 * @returns {Record<string, number>}
 */
function bucketCount(values) {
  const out = {};
  for (const v of values || []) {
    const key = v === null || v === undefined || v === "" ? "unknown" : String(v);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

/**
 * Counts distinct non-null values — e.g. distinct `user_id`s that appear in
 * a set of `usage_events` rows, for the "active users" definition used by
 * GET /api/admin/overview (see the comment at that route in server/index.js).
 * @param {Array<string | null | undefined>} values
 * @returns {number}
 */
function countDistinct(values) {
  const set = new Set();
  for (const v of values || []) {
    if (v !== null && v !== undefined) set.add(v);
  }
  return set.size;
}

/**
 * Groups `values` by identity and returns the top `topN` by count,
 * descending, as `{ key, count }`. Used for "top users by AI request count".
 * Ties are broken by first-seen order (stable — relies on Map's insertion
 * order plus Array#sort's stability).
 * @param {Array<string | null | undefined>} values
 * @param {number} topN
 * @returns {{ key: string, count: number }[]}
 */
function topByCount(values, topN) {
  const counts = new Map();
  for (const v of values || []) {
    if (v === null || v === undefined) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key, count]) => ({ key, count }));
}

/**
 * Aggregates `usage_events` rows (`{ event_type, user_id, metadata }`) into
 * per-event-type request counts and, where determinable, an error rate.
 *
 * Error-rate honesty note (see GET /api/admin/ai-usage's comment in
 * server/index.js for the fuller version): a row's success/failure is only
 * known when `metadata.success` was explicitly recorded. Every Groq-backed
 * route funnels through `callGroq()` (server/index.js), which always sets
 * `metadata.success` (true on the happy path, false in its catch block) — so
 * for every `ai.*` event type EXCEPT `ai.ats_check`, `errorRate` is a real,
 * trustworthy number. `ai.ats_check` (server/index.js's `/api/ats-check`
 * route) only calls `recordUsageEvent` with `{ success: true }` on the
 * happy path and records nothing at all if `computeDetailedAtsAnalysis`
 * throws — so its failures are invisible to `usage_events` entirely, not
 * merely miscounted. This function still reports whatever `errorRate` the
 * data supports for every type (including `ai.ats_check`, where it will
 * always read as 0 or null regardless of real failures) rather than
 * fabricating a number — callers must not present `ai.ats_check`'s error
 * rate as trustworthy.
 *
 * @param {Array<{ event_type: string, user_id?: string|null, metadata?: { success?: boolean } | null }>} rows
 * @returns {Record<string, { requestCount: number, successCount: number, failureCount: number, errorRatePct: number | null }>}
 */
function computeEventTypeStats(rows) {
  const byType = new Map();
  for (const r of rows || []) {
    if (!r || typeof r.event_type !== "string") continue;
    if (!byType.has(r.event_type)) {
      byType.set(r.event_type, { requestCount: 0, successCount: 0, failureCount: 0 });
    }
    const bucket = byType.get(r.event_type);
    bucket.requestCount += 1;
    if (r.metadata && r.metadata.success === true) bucket.successCount += 1;
    else if (r.metadata && r.metadata.success === false) bucket.failureCount += 1;
  }
  const out = {};
  for (const [type, b] of byType) {
    const tracked = b.successCount + b.failureCount;
    out[type] = {
      requestCount: b.requestCount,
      successCount: b.successCount,
      failureCount: b.failureCount,
      // null (not 0) when no row of this type ever recorded success/failure
      // at all — "unknown", not "zero errors".
      errorRatePct: tracked > 0 ? Math.round((b.failureCount / tracked) * 1000) / 10 : null,
    };
  }
  return out;
}

module.exports = {
  isAdminEmail,
  bucketCount,
  countDistinct,
  topByCount,
  computeEventTypeStats,
};
