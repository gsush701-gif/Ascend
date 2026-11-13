/**
 * Helpers for POST /api/account/delete (server/index.js).
 *
 * The `resumes` table (supabase/migrations/005_resumes.sql) has
 * `user_id references auth.users(id) on delete cascade`, so deleting the
 * `auth.users` row via `supabaseAdmin.auth.admin.deleteUser` already removes
 * the `resumes` table rows automatically at the Postgres level. It does NOT
 * remove the actual PDF files sitting in the `resumes` Storage bucket — that
 * is a separate system with no FK relationship to Postgres tables, so those
 * objects would otherwise become permanently orphaned (unreachable, since
 * their owning row and the user who could list them are both gone).
 *
 * The fix is to delete the Storage objects *before* deleting the user, using
 * the `storage_path` values off the `resumes` rows while they can still be
 * looked up. This module isolates the pure "which paths do we delete" logic
 * so it can be unit tested without a live Supabase project.
 */

/**
 * Given the raw `resumes` rows for a user (any shape with a `storage_path`
 * field — e.g. straight from `select("storage_path")`), return the list of
 * Storage object paths that should be removed from the `resumes` bucket.
 *
 * Deliberately not filtered by `deleted_at`. Deleting a resume now removes
 * its file and row straight away (`useResumes.ts`'s `deleteResume`), but an
 * older version only set `deleted_at` and left the file in the bucket. Any
 * such row whose owner has not been back since is cleaned up here too.
 *
 * Defensive against malformed rows (null/undefined entries, missing or
 * non-string `storage_path`, blank strings) so a single bad row can't throw
 * and block the whole cleanup — it's just skipped.
 *
 * @param {Array<{ storage_path?: unknown } | null | undefined>} resumeRows
 * @returns {string[]} deduplicated, non-empty storage paths
 */
function getResumeStoragePathsToDelete(resumeRows) {
  if (!Array.isArray(resumeRows)) return [];

  const paths = resumeRows
    .map((row) => row && row.storage_path)
    .filter((path) => typeof path === "string" && path.trim().length > 0);

  return Array.from(new Set(paths));
}

/**
 * Storage buckets that hold per-user files outside the `resumes` table:
 * `role-resumes` (the PDF attached to a tracked role) and `job-postings`
 * (older per-role uploads; no longer written by the UI but may still hold
 * files). Both use a flat `<user id>/<file>` layout, so everything the user
 * owns is whatever lists under their id as a folder.
 */
const USER_FOLDER_BUCKETS = ["role-resumes", "job-postings"];

/**
 * Turns a Storage `list(<user id>)` result into full object paths to remove.
 * Skips entries without a file name (sub-folders, malformed rows) so one bad
 * entry can't throw and block the rest of the cleanup.
 *
 * @param {string} userId
 * @param {Array<{ name?: unknown } | null | undefined> | null | undefined} listing
 * @returns {string[]}
 */
function getUserFolderObjectPaths(userId, listing) {
  if (!userId || !Array.isArray(listing)) return [];
  const paths = listing
    .map((item) => item && item.name)
    .filter((name) => typeof name === "string" && name.trim().length > 0)
    .map((name) => `${userId}/${name}`);
  return Array.from(new Set(paths));
}

/**
 * Whether a Stripe error from cancelling a subscription means "it's already
 * gone" (never existed in this mode, or already cancelled) — safe to carry on
 * deleting the account. Anything else (network, auth, rate limit) must STOP
 * the deletion: removing the user while their subscription is still live
 * would leave them being billed with no account to cancel it from.
 *
 * @param {{ code?: string, statusCode?: number } | null | undefined} err
 */
function isSubscriptionAlreadyGone(err) {
  if (!err) return false;
  return err.code === "resource_missing" || err.statusCode === 404;
}

module.exports = {
  getResumeStoragePathsToDelete,
  getUserFolderObjectPaths,
  isSubscriptionAlreadyGone,
  USER_FOLDER_BUCKETS,
};
