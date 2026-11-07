// A small in-memory cache where every entry expires after a fixed time and the
// oldest entry is dropped when it is full.
//
// Used for the public job search: every visitor to the public internships page
// asks for the same default listing, and the answer only changes when the daily
// sync runs, so repeating the database query for each visitor is wasted work
// (and a way for anonymous traffic to lean on the database).

function createKeyedTtlCache({ ttlMs = 60_000, max = 200, now = () => Date.now() } = {}) {
  const entries = new Map();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (now() - entry.at >= ttlMs) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      if (!entries.has(key) && entries.size >= max) entries.delete(entries.keys().next().value);
      entries.set(key, { value, at: now() });
    },
    clear() {
      entries.clear();
    },
    size() {
      return entries.size;
    },
  };
}

module.exports = { createKeyedTtlCache };
