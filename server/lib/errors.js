/**
 * Consistent error response shape for every route in this API:
 *   { "error": { "code": "SOME_ERROR_CODE", "message": "...", "requestId": "..." } }
 *
 * `requestId` is read from `req.requestId`, set by
 * `server/middleware/requestId.js` early in the middleware chain. Falls back
 * to null if that middleware somehow didn't run (should never happen in
 * practice, but this file shouldn't crash the error path if it does).
 */

const { recordErrorLog } = require("./errorLogs");

/** A small fixed vocabulary of error codes used across routes. */
const ErrorCodes = Object.freeze({
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  AI_NOT_CONFIGURED: "AI_NOT_CONFIGURED",
  AI_REQUEST_FAILED: "AI_REQUEST_FAILED",
  USAGE_LIMIT_EXCEEDED: "USAGE_LIMIT_EXCEEDED",
  UPLOAD_REJECTED: "UPLOAD_REJECTED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

/**
 * Send a response in the standard error shape.
 *
 * Also fire-and-forget records a row in `error_logs` (Admin Dashboard,
 * Phase 7 Task 6) for any 5xx response — genuine server-side failures, not
 * ordinary 4xx validation/auth responses a real user triggers by mistake
 * (uploading the wrong file, an expired session, etc). Logging every 4xx
 * here would flood the admin "recent errors" view with routine user input
 * mistakes instead of things actually worth an operator's attention; this
 * mirrors the same signal/noise judgment already applied to the request
 * logger (server/middleware/requestLogger.js logs every request either way,
 * but this table is specifically for *error triage*). Never blocks or slows
 * the response — see server/lib/errorLogs.js.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {number} status HTTP status code
 * @param {string} code one of ErrorCodes (or another short SCREAMING_CASE string)
 * @param {string} message human-readable message, safe to show to end users
 */
function sendError(req, res, status, code, message) {
  if (status >= 500) {
    recordErrorLog({
      requestId: req && req.requestId,
      route: req && req.path,
      statusCode: status,
      errorCode: code,
      message,
      userId: req && req.user && req.user.id,
    });
  }
  return res.status(status).json({
    error: {
      code,
      message,
      requestId: (req && req.requestId) || null,
    },
  });
}

module.exports = { ErrorCodes, sendError };
