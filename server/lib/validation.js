const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed UUID string (any version/variant), false for
 * anything else including non-strings — safe to call on unvalidated request
 * body fields directly. Used by every route that accepts a client-supplied
 * row id (Phase 6a's ownership-checked lookups, /analyze's optional
 * resumeId/roleId) to reject malformed ids before they ever reach a
 * database query. */
function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v.trim());
}

module.exports = { isUuid, UUID_RE };
