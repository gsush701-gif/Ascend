const { supabaseAdmin, isSupabaseConfigured } = require("./supabaseAdmin");
const { getPlan } = require("./plans");
const { ErrorCodes, sendError } = require("./errors");

/**
 * Midnight UTC on the first of the current month — the cutoff every
 * "this calendar month" usage count in this module is measured against.
 * UTC is used (rather than the caller's local time) so the boundary is
 * unambiguous and matches how Postgres timestamps are stored/compared.
 */
function startOfMonthUTC(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Pure counting helper: given an array of usage_events-shaped rows
 * (`{ event_type, created_at }`), how many match `eventType` and fall on or
 * after `since`? Mirrors the semantics of the live Supabase query in
 * `countMonthlyUsage` below, kept separate and pure so it's directly unit
 * testable without a database.
 */
function countEventsSince(events, eventType, since) {
  const cutoff = since.getTime();
  return (events || []).filter(
    (e) => e && e.event_type === eventType && new Date(e.created_at).getTime() >= cutoff,
  ).length;
}

/**
 * Core quota decision, pure and synchronous: given how many times this
 * month a user has already performed an operation and that plan's limit for
 * it, is one more call allowed?
 *
 * - `limit` not a number (operation not covered by the plan) => always allowed.
 * - `count < limit` => allowed (this would be the (count+1)-th use).
 * - `count >= limit` => denied, including exactly-at-the-limit (using the
 *   quota fully does not grant one extra call).
 */
function isWithinQuota(count, limit) {
  if (typeof limit !== "number") return true;
  return count < limit;
}

/**
 * Looks up which plan a user is on. There is no Stripe integration yet and
 * no `subscriptions` row is backfilled for existing users, so:
 *   - no row for this user_id  => free
 *   - a row exists but status isn't 'active' (e.g. a future canceled/past_due
 *     state once billing exists) => free
 *   - Supabase not configured, or the query fails for any reason (including
 *     the table not existing yet in an environment where the migration
 *     hasn't been applied) => free
 * Free is always the safe fallback: it only ever under-grants access
 * relative to a real paid plan, never over-grants.
 */
async function getUserPlanKey(userId) {
  if (!userId || !isSupabaseConfigured || !supabaseAdmin) return "free";
  try {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return "free";
    if (data.status !== "active") return "free";
    return data.plan || "free";
  } catch (e) {
    console.warn("[usage] plan lookup failed, defaulting to free:", e.message);
    return "free";
  }
}

/**
 * Counts a user's usage_events rows of `eventType` since the start of the
 * current calendar month. Returns 0 (fail-open on the count, not on the
 * quota decision) if Supabase isn't configured or the query errors, so a
 * transient DB issue degrades to "usage not yet tracked this request" rather
 * than blocking the user's request outright.
 */
async function countMonthlyUsage(userId, eventType) {
  if (!userId || !isSupabaseConfigured || !supabaseAdmin) return 0;
  const since = startOfMonthUTC();
  try {
    const { count, error } = await supabaseAdmin
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", eventType)
      .gte("created_at", since.toISOString());
    if (error) {
      console.warn("[usage] monthly count query failed, treating as 0:", error.message);
      return 0;
    }
    return count || 0;
  } catch (e) {
    console.warn("[usage] monthly count query threw, treating as 0:", e.message);
    return 0;
  }
}

/**
 * Full quota check for one (user, event type) pair. Anonymous callers
 * (`userId` falsy) are always allowed here — they have no user_id to track a
 * monthly quota by, and are instead bounded by the existing per-IP
 * `aiLimiter` (server/index.js), which already runs on every AI route ahead
 * of this check.
 *
 * Returns `{ allowed, planKey, limit, count }` so callers can both make the
 * allow/deny decision and, if useful, surface the numbers (e.g. in an error
 * message or a best-effort/no-op path like /analyze's AI summary).
 */
async function checkQuota(userId, eventType) {
  if (!userId) return { allowed: true, planKey: null, limit: null, count: 0 };
  const planKey = await getUserPlanKey(userId);
  const plan = getPlan(planKey);
  const limit = plan.limits[eventType];
  const count = await countMonthlyUsage(userId, eventType);
  return { allowed: isWithinQuota(count, limit), planKey, limit, count };
}

/**
 * Route-level guard for the AI endpoints whose entire value *is* the Groq
 * call (improve-bullet, improve-resume, improve-linkedin,
 * generate-cover-letter, generate-interview-questions, interview-feedback).
 * Call this after request validation but before the Groq call; if it
 * returns `false` it has already sent the 429-equivalent response and the
 * route handler should return immediately without calling Groq.
 *
 * (/analyze is deliberately NOT wired through this helper — see the comment
 * in server/lib/plans.js on why its AI summary layer uses `checkQuota`
 * directly instead of rejecting the whole request.)
 */
async function enforceUsageQuota(req, res, eventType) {
  if (!req.user) return true; // anonymous — governed by the IP rate limiter instead
  const { allowed, limit } = await checkQuota(req.user.id, eventType);
  if (allowed) return true;
  sendError(
    req,
    res,
    429,
    ErrorCodes.USAGE_LIMIT_EXCEEDED,
    `You've reached your plan's monthly limit (${limit}) for this feature. Upgrade or wait until next month to continue.`,
  );
  return false;
}

module.exports = {
  startOfMonthUTC,
  countEventsSince,
  isWithinQuota,
  getUserPlanKey,
  countMonthlyUsage,
  checkQuota,
  enforceUsageQuota,
};
