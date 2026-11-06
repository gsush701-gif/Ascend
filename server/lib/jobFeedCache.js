// A short-lived in-memory copy of the open job postings.
//
// Recommendations and the "This week" card both score the same few hundred
// postings for every student, and each posting carries a description of several
// thousand characters. Reading them from the database on every page view moved
// megabytes per request, so the list is read once and reused for a few minutes.
//
//   - Concurrent requests during a refresh share one database read.
//   - If a refresh fails and an older copy exists, the older copy is served
//     (slightly stale beats an error page).
//   - clear() drops the copy, so a finished sync shows up straight away.

function createJobFeedCache({ fetchRows, ttlMs = 10 * 60 * 1000, now = () => Date.now() }) {
  let rows = null;
  let loadedAt = 0;
  let inflight = null;

  return {
    async get() {
      if (rows && now() - loadedAt < ttlMs) return rows;
      if (inflight) return inflight;
      inflight = fetchRows()
        .then((fresh) => {
          rows = fresh;
          loadedAt = now();
          return fresh;
        })
        .catch((err) => {
          if (rows) return rows;
          throw err;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
    clear() {
      rows = null;
      loadedAt = 0;
    },
  };
}

module.exports = { createJobFeedCache };
