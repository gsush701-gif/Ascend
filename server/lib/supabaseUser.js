const { createClient } = require("@supabase/supabase-js");
const { supabaseAdmin, isSupabaseConfigured } = require("./supabaseAdmin");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const userScopedConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!userScopedConfigured) {
  console.warn(
    "[supabaseUser] SUPABASE_ANON_KEY not set — ownership-checked lookups " +
      "(e.g. /api/generate-cold-email, /api/career-advice) will fall back to " +
      "the admin client with an explicit user_id filter instead of an " +
      "RLS-scoped client. Still correct, just without the extra RLS layer.",
  );
}

/**
 * Builds a Supabase client authenticated as the calling user (their own
 * access token, public anon key) rather than the service-role key. Row
 * Level Security then enforces ownership the same way it does for every
 * direct-from-browser query in this codebase — a query for a row the
 * token's user doesn't own simply returns no rows, regardless of what id is
 * requested. Returns null if SUPABASE_ANON_KEY isn't configured or no token
 * is given; callers must handle that by falling back to
 * `fetchOwnedRowViaAdmin` below.
 */
function getUserScopedClient(token) {
  if (!userScopedConfigured || !token) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/**
 * Fetches a single row by id from `table`, scoped to `userId`, using the
 * admin (service-role) client with an explicit `user_id` equality filter.
 * This is the fallback path when a user-scoped (RLS) client isn't available
 * — it produces the identical result a correct RLS policy would (a row
 * belonging to a different user is never returned), just via an
 * explicit predicate instead of a database-enforced policy.
 */
async function fetchOwnedRowViaAdmin(table, id, userId) {
  if (!isSupabaseConfigured || !supabaseAdmin) return { row: null, error: "Database not configured" };
  const { data, error } = await supabaseAdmin.from(table).select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) return { row: null, error: error.message };
  return { row: data || null, error: null };
}

/**
 * Ownership-checked single-row fetch for a user-owned table (e.g. `contacts`,
 * `roles`), used by routes that accept an id from the client and must never
 * let one user read another user's row by guessing/brute-forcing ids
 * (Phase 6a Tasks 3/4: cold-email contact lookup, career-advice role lookup).
 *
 * Prefers a real RLS-scoped client (built from the caller's own access
 * token) when SUPABASE_ANON_KEY is configured — this is the stronger,
 * defense-in-depth path: even a bug that forgot the `user_id` filter would
 * still be safe, because the database itself enforces the policy. Falls
 * back to the admin client + explicit `user_id` filter otherwise, which is
 * still a correct ownership check, just without that extra layer.
 *
 * Returns `{ row, error }` — `row` is `null` (not an error) when the id
 * doesn't exist or isn't owned by this user; callers should treat that as a
 * 404, not a 500.
 */
async function fetchOwnedRow({ table, id, userId, token }) {
  const scopedClient = getUserScopedClient(token);
  if (scopedClient) {
    const { data, error } = await scopedClient.from(table).select("*").eq("id", id).maybeSingle();
    if (error) return { row: null, error: error.message };
    return { row: data || null, error: null };
  }
  return fetchOwnedRowViaAdmin(table, id, userId);
}

module.exports = { getUserScopedClient, fetchOwnedRow, isUserScopedConfigured: userScopedConfigured };
