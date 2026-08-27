// Active job provider selection (Phase 7 Task 8). Which provider backs
// GET /api/jobs/search (server/index.js) is a JOB_PROVIDER env var, not a
// code change, for the parts of this feature that don't need
// provider-specific logic (the route handler, jobMatching.js, and the
// frontend all only ever call `activeProvider.search(...)`).
//
// To plug in a real job-listing API later:
//   1. Add server/lib/jobProviders/<name>Provider.js implementing the
//      JobProvider contract in ./types.js (isConfigured + async search()).
//   2. require() it below and add a matching case in selectProvider().
//   3. Set JOB_PROVIDER=<name> (plus whatever API key/env vars that
//      provider needs) in the environment.
// No changes needed to server/index.js's routes, server/lib/jobMatching.js,
// or any frontend code — they only depend on the JobProvider shape.

const { NullJobProvider } = require("./nullProvider");

const JOB_PROVIDER = (process.env.JOB_PROVIDER || "none").trim().toLowerCase();

function selectProvider(name) {
  switch (name) {
    case "none":
      return NullJobProvider;
    default:
      console.warn(
        `[jobProviders] Unknown JOB_PROVIDER "${name}" — falling back to NullJobProvider (no live listings).`,
      );
      return NullJobProvider;
  }
}

const activeProvider = selectProvider(JOB_PROVIDER);
const isJobProviderConfigured = Boolean(activeProvider.isConfigured);

if (!isJobProviderConfigured) {
  console.warn(
    "[jobProviders] No live job-listing provider configured (JOB_PROVIDER=" +
      JOB_PROVIDER +
      ") — GET /api/jobs/search returns an empty, clearly-flagged result until a real provider is wired in.",
  );
}

module.exports = { activeProvider, isJobProviderConfigured, JOB_PROVIDER };
