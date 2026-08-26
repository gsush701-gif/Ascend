/**
 * Structured, one-JSON-object-per-line request logger, written to stdout
 * (which Render already captures as logs). Replaces morgan("tiny") with
 * something actually useful for debugging a specific user's specific
 * request: request id, user id (if authenticated by the time the response
 * finishes — i.e. after optionalAuth has run for routes that use it),
 * method, path, status code, and duration in ms.
 *
 * Deliberately minimal (no external logging library) per the project's
 * lightweight-infra principle for this phase.
 */
function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const line = {
      t: new Date().toISOString(),
      requestId: req.requestId || null,
      userId: (req.user && req.user.id) || null,
      method: req.method,
      // req.path excludes the query string, which may contain sensitive
      // values (tokens, resume text fragments, etc) — never log req.originalUrl.
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    };
    // console.log (not .error) even for error statuses — this is a request
    // log, not an error log; error detail is logged separately where the
    // error actually occurs (route catch blocks, the global handler).
    console.log(JSON.stringify(line));
  });

  next();
}

module.exports = { requestLogger };
