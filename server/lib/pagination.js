// --- Shared pagination convention (Admin Dashboard, Phase 7 Task 6) ---
//
// No pagination convention existed anywhere else in this codebase before
// this (checked: no `?page=`/`pageSize` query param handling in
// server/index.js, no `.range()`/offset-based Supabase queries). This
// establishes one, used consistently across every paginated admin route:
// `?page=<1-indexed>&pageSize=<n>` in, `{ page, pageSize, total, totalPages,
// items }` out.
//
// Pure/side-effect-free so it's directly unit testable without a database —
// mirrors the existing style of server/lib/usage.js's countEventsSince /
// isWithinQuota.

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Parses/clamps `page`/`pageSize` query params into a safe, usable shape.
 * Never throws on garbage input (non-numeric, negative, absurdly large) —
 * everything invalid silently falls back to a sane default rather than
 * erroring, since this is a read-only admin convenience, not something worth
 * rejecting requests over.
 *
 * @param {{ page?: unknown, pageSize?: unknown }} query
 * @param {{ defaultPageSize?: number, maxPageSize?: number }} [opts]
 * @returns {{ page: number, pageSize: number, offset: number }}
 */
function parsePagination(query, opts = {}) {
  const defaultPageSize = opts.defaultPageSize || DEFAULT_PAGE_SIZE;
  const maxPageSize = opts.maxPageSize || MAX_PAGE_SIZE;

  let page = parseInt(query && query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  let pageSize = parseInt(query && query.pageSize, 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultPageSize;
  pageSize = Math.min(pageSize, maxPageSize);

  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

/**
 * Builds the standard paginated-list response shape. `total` is the true
 * total row count (from a separate `count: "exact", head: true` query, or
 * an admin-API-reported total), independent of how many rows are in `items`
 * for this page.
 * @param {{ page: number, pageSize: number, total: number, items: unknown[] }} args
 */
function buildPageResult({ page, pageSize, total, items }) {
  return {
    page,
    pageSize,
    total,
    totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
    items,
  };
}

module.exports = { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, parsePagination, buildPageResult };
