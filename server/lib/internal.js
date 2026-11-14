// Keeps the owner's own activity out of the Admin numbers.
//
// While Ascend has only a handful of real users, the founder's own sign-ins,
// test accounts and page views are most of the data, which makes every number on
// the Admin page misleading. Two things are treated as "internal" and hidden by
// default (the Admin page has a switch to show them again):
//
//  1. Accounts: anyone listed in ADMIN_EMAILS, plus any extra addresses in
//     INTERNAL_EMAILS (for test accounts). Matched by email, case-insensitively.
//  2. Browsers: the anonymous visitor ids (`vid`) of browsers that opened the
//     Admin page while signed in as an admin. The id is recorded as an
//     `internal_browser` usage event, which /api/track does not accept, so only
//     an admin can add one. Because older visits carry the same id, this also
//     removes visits made before the browser was marked.
//
// Everything except the resolver at the bottom is a pure function over rows that
// were already fetched, so it is unit-tested without a database.

const INTERNAL_BROWSER_EVENT = "internal_browser";

/**
 * Lower-cased, de-duplicated set of addresses from one or more comma-separated lists.
 * @param {...(string | null | undefined)} csvs
 * @returns {Set<string>}
 */
function parseEmailList(...csvs) {
  const out = new Set();
  for (const csv of csvs) {
    if (typeof csv !== "string") continue;
    for (const part of csv.split(",")) {
      const email = part.trim().toLowerCase();
      if (email) out.add(email);
    }
  }
  return out;
}

/**
 * Ids of the accounts whose email is in `emails`.
 * @param {Array<{ id?: string, email?: string | null } | null | undefined>} users auth users
 * @param {Set<string>} emails from parseEmailList
 * @returns {Set<string>}
 */
function matchInternalUserIds(users, emails) {
  const ids = new Set();
  if (!emails || emails.size === 0) return ids;
  for (const u of users || []) {
    if (!u || typeof u.id !== "string" || typeof u.email !== "string") continue;
    if (emails.has(u.email.trim().toLowerCase())) ids.add(u.id);
  }
  return ids;
}

/**
 * Drops rows that belong to an internal account. Rows with no user (anonymous
 * events) are kept: they are judged by their browser id instead.
 * @template T
 * @param {T[]} rows
 * @param {Set<string>} userIds
 * @param {string} [key] the column holding the user id
 * @returns {T[]}
 */
function dropInternalUsers(rows, userIds, key = "user_id") {
  if (!userIds || userIds.size === 0) return rows || [];
  return (rows || []).filter((r) => {
    const id = r && r[key];
    return !(typeof id === "string" && userIds.has(id));
  });
}

/**
 * Drops events from an internal browser (`metadata.vid` is one of `vids`).
 * @template T
 * @param {T[]} rows
 * @param {Set<string>} vids
 * @returns {T[]}
 */
function dropInternalBrowsers(rows, vids) {
  if (!vids || vids.size === 0) return rows || [];
  return (rows || []).filter((r) => {
    const vid = r && r.metadata && r.metadata.vid;
    return !(typeof vid === "string" && vids.has(vid));
  });
}

/** Whether a browser id is in the shape the app generates (a UUID, or its old random fallback). */
function isValidVisitorId(vid) {
  return typeof vid === "string" && /^[A-Za-z0-9-]{8,64}$/.test(vid);
}

/**
 * Looks up the internal accounts and browsers, remembering the answer briefly:
 * every Admin page load asks several routes for it at once.
 *
 * @param {object} opts
 * @param {any} opts.supabaseAdmin service-role client, or null when not configured
 * @param {() => Array<string | null | undefined>} opts.getEmailLists current ADMIN_EMAILS and INTERNAL_EMAILS values
 * @param {number} [opts.ttlMs]
 * @param {() => number} [opts.now]
 */
function createInternalResolver({ supabaseAdmin, getEmailLists, ttlMs = 60_000, now = Date.now }) {
  let cached = null;
  let inflight = null;

  async function load() {
    const userIds = new Set();
    const vids = new Set();
    if (!supabaseAdmin) return { userIds, vids };

    const emails = parseEmailList(...getEmailLists());
    if (emails.size > 0) {
      // One page of 1000 is far more than this app has users; the loop is a
      // bound, not an expectation.
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const users = (data && data.users) || [];
        for (const id of matchInternalUserIds(users, emails)) userIds.add(id);
        if (users.length < 1000) break;
      }
    }

    const { data: marks, error: marksError } = await supabaseAdmin
      .from("usage_events")
      .select("metadata")
      .eq("event_type", INTERNAL_BROWSER_EVENT)
      .limit(1000);
    if (marksError) throw marksError;
    for (const m of marks || []) {
      const vid = m && m.metadata && m.metadata.vid;
      if (isValidVisitorId(vid)) vids.add(vid);
    }
    return { userIds, vids };
  }

  return {
    /** @returns {Promise<{ userIds: Set<string>, vids: Set<string> }>} */
    async get() {
      if (cached && now() - cached.at < ttlMs) return cached.value;
      if (!inflight) {
        inflight = load()
          .then((value) => {
            cached = { at: now(), value };
            return value;
          })
          .finally(() => {
            inflight = null;
          });
      }
      return inflight;
    },
    clear() {
      cached = null;
    },
  };
}

module.exports = {
  INTERNAL_BROWSER_EVENT,
  parseEmailList,
  matchInternalUserIds,
  dropInternalUsers,
  dropInternalBrowsers,
  isValidVisitorId,
  createInternalResolver,
};
