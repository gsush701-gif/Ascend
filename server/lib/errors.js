/**
 * Consistent error response shape for every route in this API:
 *   { "error": { "code": "SOME_ERROR_CODE", "message": "...", "requestId": "..." } }
 *
 * `requestId` is read from `req.requestId`, set by
 * `server/middleware/requestId.js` early in the middleware chain. Falls back
 * to null if that middleware somehow didn't run (should never happen in
 * practice, but this file shouldn't crash the error path if it does).
 */

/** A small fixed vocabulary of error codes used across routes. */
const ErrorCodes = Object.freeze({
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
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
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {number} status HTTP status code
 * @param {string} code one of ErrorCodes (or another short SCREAMING_CASE string)
 * @param {string} message human-readable message, safe to show to end users
 */
function sendError(req, res, status, code, message) {
  return res.status(status).json({
    error: {
      code,
      message,
      requestId: (req && req.requestId) || null,
    },
  });
}

module.exports = { ErrorCodes, sendError };
