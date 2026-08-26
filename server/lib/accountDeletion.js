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
 * Deliberately not filtered by `deleted_at`: soft-deleting a resume
 * (`useResumes.ts`'s `deleteResume`) only sets `deleted_at` on the row and
 * never removes the underlying Storage object, so a soft-deleted resume's
 * file is still sitting in the bucket and must be cleaned up here too.
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

module.exports = { getResumeStoragePathsToDelete };
