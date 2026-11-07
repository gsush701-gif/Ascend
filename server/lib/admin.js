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
 * @returns {Record<string, { requestCount: number, successCount: number, failureCount: number, errorRatePct: number | null, totalTokens: number | null, estCostUsd: number | null, avgCostUsd: number | null, costTrackedCount: number }>}
 */
function computeEventTypeStats(rows) {
  const byType = new Map();
  for (const r of rows || []) {
    if (!r || typeof r.event_type !== "string") continue;
    if (!byType.has(r.event_type)) {
      byType.set(r.event_type, {
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        costTrackedCount: 0,
        totalTokens: 0,
        estCostUsd: 0,
      });
    }
    const bucket = byType.get(r.event_type);
    bucket.requestCount += 1;
    // Token/cost fields come from callGroq() (server/lib/llmCost.js); rows
    // recorded before that existed, and non-LLM rows, simply have none.
    if (r.metadata && typeof r.metadata.estCostUsd === "number") {
      bucket.costTrackedCount += 1;
      bucket.estCostUsd += r.metadata.estCostUsd;
      bucket.totalTokens += Number(r.metadata.totalTokens) || 0;
    }
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
      // Cost fields are null (not 0) when no row of this type recorded any —
      // "unknown", not "free". avgCostUsd averages only over rows that did.
      totalTokens: b.costTrackedCount > 0 ? b.totalTokens : null,
      estCostUsd: b.costTrackedCount > 0 ? Math.round(b.estCostUsd * 1e6) / 1e6 : null,
      avgCostUsd: b.costTrackedCount > 0 ? Math.round((b.estCostUsd / b.costTrackedCount) * 1e6) / 1e6 : null,
      costTrackedCount: b.costTrackedCount,
    };
  }
  return out;
}

/**
 * The activation steps the admin funnel reports, in the order a new student
 * would naturally reach them. Event keys are the product events recorded by
 * POST /api/track (src/lib/analytics.ts).
 */
const FUNNEL_STEPS = [
  { key: "resume_uploaded", label: "Uploaded a resume" },
  { key: "analysis_completed", label: "Ran an analysis" },
  { key: "role_created", label: "Added a role" },
  { key: "cover_letter_generated", label: "Generated a cover letter" },
  { key: "interview_started", label: "Practised an interview" },
];

/**
 * Activation funnel for a cohort of signups: for each step, how many of those
 * users ever did it. Steps are counted independently rather than as a strict
 * sequence, because the app isn't linear (a role can be added without an
 * analysis, a resume can be pasted rather than uploaded) — a strict funnel
 * would drop real users. Two derived numbers carry the story instead:
 *   - activated: did BOTH an analysis and added a role (the core loop).
 *   - didNothing: signed up but triggered none of the steps (the leak).
 * Rows from users outside the cohort, or with no user, are ignored.
 *
 * @param {string[]} cohortUserIds users who signed up in the window
 * @param {Array<{ user_id?: string|null, event_type?: string }>} eventRows
 * @param {{ key: string, label: string }[]} [steps]
 */
function computeFunnel(cohortUserIds, eventRows, steps = FUNNEL_STEPS) {
  const cohort = new Set(cohortUserIds || []);
  const byEvent = new Map(steps.map((s) => [s.key, new Set()]));
  const didAny = new Set();
  for (const r of eventRows || []) {
    if (!r || !r.user_id || !cohort.has(r.user_id)) continue;
    const set = byEvent.get(r.event_type);
    if (!set) continue;
    set.add(r.user_id);
    didAny.add(r.user_id);
  }
  const total = cohort.size;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 1000) / 10 : null);
  const analysed = byEvent.get("analysis_completed") || new Set();
  const addedRole = byEvent.get("role_created") || new Set();
  const activated = [...analysed].filter((id) => addedRole.has(id)).length;
  const didNothing = total - didAny.size;
  return {
    signups: total,
    steps: steps.map((s) => ({
      key: s.key,
      label: s.label,
      users: byEvent.get(s.key).size,
      pctOfSignups: pct(byEvent.get(s.key).size),
    })),
    activated: { users: activated, pctOfSignups: pct(activated) },
    didNothing: { users: didNothing, pctOfSignups: pct(didNothing) },
  };
}

/** Events the public /try page reports (anonymous visitors, no account). */
const TRY_EVENTS = [
  "try_viewed",
  "try_analysis_completed",
  "try_signup_clicked",
  "internships_viewed",
  "internships_cta_clicked",
];

/**
 * Funnel for the logged-out /try and /internships pages from their anonymous events. Visitors are
 * counted by the random per-browser id the page sends in `metadata.vid` (no
 * account, no resume or posting content); a row without one still counts as a
 * raw event but not as a distinct visitor.
 *
 * @param {Array<{ event_type?: string, metadata?: { vid?: unknown, example?: unknown } | null }>} rows
 */
function computeTryStats(rows) {
  const seen = {};
  const events = {};
  for (const type of TRY_EVENTS) {
    seen[type] = new Set();
    events[type] = 0;
  }
  let analysesOnExample = 0;
  let analysesOnOwn = 0;
  for (const r of rows || []) {
    if (!r || !(r.event_type in events)) continue;
    events[r.event_type] += 1;
    const vid = r.metadata && typeof r.metadata.vid === "string" ? r.metadata.vid : null;
    if (vid) seen[r.event_type].add(vid);
    if (r.event_type === "try_analysis_completed") {
      if (r.metadata && r.metadata.example === true) analysesOnExample += 1;
      else analysesOnOwn += 1;
    }
  }
  return {
    visitors: seen.try_viewed.size,
    pageViews: events.try_viewed,
    analyses: events.try_analysis_completed,
    analysesVisitors: seen.try_analysis_completed.size,
    analysesOnExample,
    analysesOnOwn,
    signupClicks: events.try_signup_clicked,
    signupClickVisitors: seen.try_signup_clicked.size,
    internshipsVisitors: seen.internships_viewed.size,
    internshipsViews: events.internships_viewed,
    internshipsCtaVisitors: seen.internships_cta_clicked.size,
    internshipsCtaClicks: events.internships_cta_clicked,
  };
}

module.exports = {
  FUNNEL_STEPS,
  TRY_EVENTS,
  computeTryStats,
  computeFunnel,
  isAdminEmail,
  bucketCount,
  countDistinct,
  topByCount,
  computeEventTypeStats,
};
