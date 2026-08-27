// Job provider contract (Phase 7 Task 8 — Job Discovery architecture).
//
// This app has no compliant job-listing data provider configured today —
// no job-board API is wired in, and scraping any job site is explicitly out
// of scope (many prohibit it in their terms). This file exists so that when
// the owner does sign up for a real, licensed job-listing API later, the
// integration point is a single new file implementing the interface below,
// not a rewrite of the routes/matching logic that already exist.
//
// This codebase is mostly-plain-JS on the server (see server/lib/scoring.js,
// server/lib/stripe.js), so the contract here is documented as JSDoc typedefs
// + a written description rather than a TypeScript interface or an abstract
// base class — nothing here needs runtime enforcement beyond what
// server/lib/jobProviders/nullProvider.js already demonstrates by example.
//
// Every provider module (server/lib/jobProviders/nullProvider.js today; a
// real one added later, e.g. server/lib/jobProviders/adzunaProvider.js) must
// export an object shaped like `JobProvider` below, and follow this
// codebase's established "configured-or-no-op" convention (see
// server/lib/stripe.js's `isStripeConfigured` / server/lib/supabaseAdmin.js):
//   - `isConfigured: boolean` — true only when the provider has everything
//     it needs (API key, base URL, etc.) to make a real call.
//   - `search(params)` must NEVER throw for "not configured" or for an
//     upstream failure — always resolve to a `JobSearchResult`, with
//     `providerConfigured` reflecting the truth and `jobs: []` when there's
//     nothing real to return. Routes calling this (server/index.js's
//     GET /api/jobs/search) rely on that guarantee to never need a provider
//     -specific try/catch.
//   - Never fabricate a posting. If the upstream call fails or returns
//     nothing, return an empty result — not a placeholder/sample job.
//
// @typedef {Object} JobSearchParams
// @property {string} [keywords] - free-text keywords (title/skills/company blended search)
// @property {string} [location] - free-text location, e.g. "Seattle, WA"
// @property {("Remote"|"Hybrid"|"Onsite")} [remoteType]
// @property {number} [salaryMin] - annual USD, inclusive lower bound
// @property {number} [salaryMax] - annual USD, inclusive upper bound
// @property {("Yes"|"No"|"Unknown")} [sponsorship] - employer-stated visa sponsorship
// @property {string[]} [skills] - canonical or free-text skill names, ANY-of match
// @property {string} [experienceLevel] - e.g. "Internship", "Entry", "Mid", "Senior"
// @property {string} [company]
// @property {string} [jobType] - employment_type, e.g. "Full-time", "Internship", "Contract"
// @property {number} [page] - 1-based
// @property {number} [pageSize]
//
// @typedef {Object} ProviderJob - shape mirrors the `jobs` table
// (supabase/migrations/009_jobs.sql) so a real provider's results can be
// upserted into it (or returned pass-through) with no field remapping.
// @property {string} id
// @property {string} company
// @property {string} title
// @property {string} [description]
// @property {string} [url]
// @property {string} [source]
// @property {string} [location]
// @property {string} [remoteType]
// @property {string} [employmentType]
// @property {number} [salaryMin]
// @property {number} [salaryMax]
// @property {string} [salaryCurrency]
// @property {string} [sponsorship]
// @property {string} [experienceLevel]
// @property {string} [postedAt] - ISO timestamp
// @property {string} [deadline] - ISO timestamp
//
// @typedef {Object} JobSearchResult
// @property {ProviderJob[]} jobs
// @property {number} totalCount
// @property {number} page
// @property {number} pageSize
// @property {boolean} providerConfigured - false when no real provider is
//   wired in; callers (the frontend, via GET /api/jobs/search) must render
//   this as "search isn't connected yet", never as "zero results matched".
//
// @typedef {Object} JobProvider
// @property {boolean} isConfigured
// @property {(params: JobSearchParams) => Promise<JobSearchResult>} search

module.exports = {};
