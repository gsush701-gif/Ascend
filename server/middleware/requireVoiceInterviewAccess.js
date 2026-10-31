const { isAdminEmail } = require("../lib/admin");
const { ErrorCodes, sendError } = require("../lib/errors");

/**
 * Whether `email` may use the voice interview feature. The feature is locked
 * to an allowlist while it's still being tuned: a comma-separated
 * `VOICE_INTERVIEW_EMAILS` env var, checked the same way (and with the same
 * fail-closed behavior) as `ADMIN_EMAILS` — unset or empty means nobody has
 * access. To open the feature up later, replace this check with a plan/flag
 * check; the routes and the frontend lock both go through here.
 *
 * @param {string | null | undefined} email verified email from `req.user`
 */
function hasVoiceInterviewAccess(email) {
  return isAdminEmail(email, process.env.VOICE_INTERVIEW_EMAILS);
}

/**
 * Hard server-side lock for the voice interview's backend routes
 * (/api/interview-speech, /api/interview-turn, /api/interview-evaluation).
 * Must run AFTER `optionalAuth` (needs the verified `req.user`) and BEFORE the
 * route handler, so a locked-out caller never spends Groq/ElevenLabs credits.
 * The frontend lock is UX only; this is the actual enforcement.
 *
 * - Not logged in => 401.
 * - Logged in but not on the allowlist => 403.
 */
function requireVoiceInterviewAccess(req, res, next) {
  if (!req.user) {
    return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
  }
  if (!hasVoiceInterviewAccess(req.user.email)) {
    return sendError(
      req,
      res,
      403,
      ErrorCodes.FORBIDDEN,
      "Voice interview is not available on your account yet",
    );
  }
  return next();
}

module.exports = { hasVoiceInterviewAccess, requireVoiceInterviewAccess };
