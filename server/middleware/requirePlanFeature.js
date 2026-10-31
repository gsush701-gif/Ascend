const { getUserPlanKey } = require("../lib/usage");
const { getPlan } = require("../lib/plans");
const { ErrorCodes, sendError } = require("../lib/errors");

/**
 * Whether the user's current plan includes `feature` (a key of
 * `PLANS[x].features` in server/lib/plans.js). Plan lookup is
 * `getUserPlanKey`, so no subscription row, a non-'active' status, or any
 * lookup failure all resolve to `free` — a paid feature can only ever be
 * under-granted on error, never over-granted.
 *
 * @param {string | null | undefined} userId
 * @param {string} feature
 */
async function userHasPlanFeature(userId, feature) {
  if (!userId) return false;
  const planKey = await getUserPlanKey(userId);
  return getPlan(planKey).features?.[feature] === true;
}

/**
 * Hard server-side paywall for routes that belong to a paid plan's feature
 * (currently the voice interview's /api/interview-speech, /api/interview-turn
 * and /api/interview-evaluation → `voiceInterview`). Must run AFTER
 * `optionalAuth` (needs the verified `req.user`) and BEFORE the route
 * handler, so a free user never spends Groq/ElevenLabs credits. The
 * frontend's locked state is UX only; this is the actual enforcement.
 *
 * - Not logged in => 401.
 * - Logged in, plan doesn't include the feature => 403 (FORBIDDEN).
 */
function requirePlanFeature(feature, label) {
  return async function requirePlanFeatureMiddleware(req, res, next) {
    if (!req.user) {
      return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
    }
    try {
      if (!(await userHasPlanFeature(req.user.id, feature))) {
        return sendError(
          req,
          res,
          403,
          ErrorCodes.FORBIDDEN,
          `${label} is a Pro feature. Upgrade your plan to use it.`,
        );
      }
    } catch (e) {
      return next(e);
    }
    return next();
  };
}

module.exports = { userHasPlanFeature, requirePlanFeature };
