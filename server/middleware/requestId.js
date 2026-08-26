const crypto = require("crypto");

/**
 * Assigns a UUID to every request (req.requestId) and echoes it back as the
 * X-Request-Id response header, so a specific user's specific request can be
 * traced through logs, error responses, and (if the caller wants) their own
 * support ticket. Must run early in the middleware chain, before any route
 * or error handler that reads req.requestId.
 */
function requestId(req, res, next) {
  const incoming = req.headers["x-request-id"];
  // Trust a caller-supplied id (useful for correlating client-side error
  // reports with server logs) only if it looks like a reasonable opaque
  // token; otherwise mint our own. Never let this throw.
  const id =
    typeof incoming === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(incoming)
      ? incoming
      : crypto.randomUUID();

  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}

module.exports = { requestId };
