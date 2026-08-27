const { isAdminEmail } = require("../lib/admin");
const { ErrorCodes, sendError } = require("../lib/errors");

/**
 * Hard auth boundary for every /api/admin/* route. Must run AFTER
 * `optionalAuth` (needs the verified `req.user` it sets) and BEFORE the
 * route handler.
 *
 * There is no roles/permissions system in this app (see server/lib/admin.js's
 * header comment) — this is the simplest mechanism that's still a real,
 * server-side security boundary: a comma-separated `ADMIN_EMAILS` env var
 * checked against the authenticated user's email, read only from `req.user`
 * (which `optionalAuth` only ever sets from a Supabase-verified access
 * token — never from a client-supplied header/body value). A frontend route
 * guard is UX only; this middleware is the actual enforcement, independently
 * re-checked on every request, on every route below.
 *
 * - No `req.user` at all (not logged in) => 401.
 * - Logged in but not in `ADMIN_EMAILS` => 403.
 * - Logged in and in `ADMIN_EMAILS` => next().
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return sendError(req, res, 401, ErrorCodes.UNAUTHORIZED, "Login required");
  }
  if (!isAdminEmail(req.user.email, process.env.ADMIN_EMAILS)) {
    return sendError(req, res, 403, ErrorCodes.FORBIDDEN, "You do not have access to this resource");
  }
  return next();
}

module.exports = { requireAdmin };
