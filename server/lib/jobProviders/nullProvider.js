// The only concrete job provider shipped today — see ./types.js for the
// interface this implements (and that any real provider added later must
// implement too). Deliberately does nothing: no HTTP call, no fixture data,
// no fabricated postings. Exists so GET /api/jobs/search (server/index.js)
// and the frontend's /jobs search UI have something correct to call against
// before a real job-listing provider is configured, and so the swap to a
// real provider is additive (a new file + an env var), not a rewrite.

const DEFAULT_PAGE_SIZE = 20;

function normalizePage(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function normalizePageSize(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_PAGE_SIZE;
}

/** @type {import('./types').JobProvider} */
const NullJobProvider = {
  isConfigured: false,

  // Never throws, never fabricates a posting — always resolves to an empty,
  // clearly-flagged result. `params` is accepted (and echoed back via
  // page/pageSize) purely so callers don't need a special case for this
  // provider vs. a real one.
  async search(params = {}) {
    return {
      jobs: [],
      totalCount: 0,
      page: normalizePage(params.page),
      pageSize: normalizePageSize(params.pageSize),
      providerConfigured: false,
    };
  },
};

module.exports = { NullJobProvider };
