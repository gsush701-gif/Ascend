import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import type { CoverLetterSource, CoverLetterVersion } from "../../../types/coverLetter";
import { duplicateVersionName, nextVersionNumber, pickPromotedVersion } from "../versionLogic";

const UNIQUE_VIOLATION = "23505";
const MAX_INSERT_ATTEMPTS = 3;

type VersionRow = {
  id: string;
  role_id: string;
  version_number: number;
  name: string | null;
  content: string;
  source: CoverLetterSource;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function rowToVersion(row: VersionRow): CoverLetterVersion {
  return {
    id: row.id,
    roleId: row.role_id,
    versionNumber: row.version_number,
    name: row.name,
    content: row.content,
    source: row.source,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS =
  "id, role_id, version_number, name, content, source, is_active, created_at, updated_at";

/**
 * CRUD for the `cover_letter_versions` table (see
 * supabase/migrations/016_cover_letter_versions.sql). Direct-to-Supabase,
 * RLS-protected — same pattern as useResumes.ts/useContacts.ts for other
 * per-user tables — no backend route needed since nothing here requires a
 * secret or server-side computation.
 *
 * `syncActiveCoverLetter` should be the tracker's `updateCoverLetter(id,
 * text)` (from useTracker.ts) so that whenever the active version here
 * changes, the legacy `roles.cover_letter` mirror column is written through
 * that same single code path rather than a second parallel writer.
 */
export function useCoverLetterVersions(
  roleId: string | undefined,
  syncActiveCoverLetter: (roleId: string, content: string) => void,
) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<CoverLetterVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Returns a promise so callers (createVersion, deleteVersion, etc.) can
   * await the refetch before resolving — avoids a flash of stale data
   * between a write and the list catching up. */
  const refresh = useCallback(async (): Promise<void> => {
    if (!user || !roleId) {
      setVersions([]);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("cover_letter_versions")
      .select(SELECT_COLUMNS)
      .eq("role_id", roleId)
      .order("version_number", { ascending: false });
    if (err) {
      console.error("[useCoverLetterVersions] load failed:", err);
      setError(err.message);
    } else {
      setError(null);
      setVersions(((data as VersionRow[] | null) ?? []).map(rowToVersion));
    }
    setLoading(false);
  }, [user, roleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Insert a new version, retrying with a freshly-queried version number if
   * a concurrent insert (another tab, a double-click) already claimed the
   * one we computed — the unique index on (role_id, version_number) is the
   * backstop that makes this race detectable instead of silently
   * corrupting data.
   */
  const insertVersion = useCallback(
    async (
      content: string,
      name: string | null,
      source: CoverLetterSource,
    ): Promise<{ data: CoverLetterVersion | null; error: string | null }> => {
      if (!user || !roleId) return { data: null, error: "Not logged in" };

      // Loop (not recursion) so a concurrent insert claiming the version
      // number we computed (another tab, a double-click) can be retried
      // with a freshly-queried number instead of silently colliding — the
      // unique index on (role_id, version_number) is what makes the race
      // detectable at all.
      for (let attempt = 0; attempt <= MAX_INSERT_ATTEMPTS; attempt++) {
        const { data: existingRows, error: findError } = await supabase
          .from("cover_letter_versions")
          .select("version_number")
          .eq("role_id", roleId);
        if (findError) return { data: null, error: findError.message };

        const versionNumber = nextVersionNumber(
          ((existingRows as { version_number: number }[] | null) ?? []).map((r) => r.version_number),
        );

        const { data, error: insertError } = await supabase
          .from("cover_letter_versions")
          .insert({
            role_id: roleId,
            user_id: user.id,
            version_number: versionNumber,
            name,
            content,
            source,
          })
          .select(SELECT_COLUMNS)
          .single();

        if (!insertError) return { data: rowToVersion(data as VersionRow), error: null };
        if (insertError.code !== UNIQUE_VIOLATION || attempt === MAX_INSERT_ATTEMPTS) {
          return { data: null, error: insertError.message };
        }
        // else: another insert won the race for this version number — loop
        // and recompute.
      }
      return { data: null, error: "Failed to save version after retries" };
    },
    [user, roleId],
  );

  /** Deactivate every other version for this role, then activate one and
   * sync `roles.cover_letter` to match. Two sequential RLS-scoped updates,
   * same pattern as useResumes.ts's setDefaultResume. */
  const activateAndSync = useCallback(
    async (version: CoverLetterVersion): Promise<{ error: string | null }> => {
      if (!roleId) return { error: "No role" };
      const { error: clearError } = await supabase
        .from("cover_letter_versions")
        .update({ is_active: false })
        .eq("role_id", roleId)
        .neq("id", version.id);
      if (clearError) return { error: clearError.message };

      const { error: setError } = await supabase
        .from("cover_letter_versions")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", version.id);
      if (setError) return { error: setError.message };

      syncActiveCoverLetter(roleId, version.content);
      return { error: null };
    },
    [roleId, syncActiveCoverLetter],
  );

  /**
   * Create a new version (e.g. from an AI generation or a fresh manual
   * draft). Pass `activate: true` (the common case) to also make it the
   * role's active version and sync `roles.cover_letter`.
   */
  const createVersion = useCallback(
    async (
      content: string,
      options?: { name?: string | null; source?: CoverLetterSource; activate?: boolean },
    ): Promise<{ error: string | null; version?: CoverLetterVersion }> => {
      if (!user || !roleId) return { error: "You must be logged in." };
      const source = options?.source ?? "generated";
      const name = options?.name?.trim() || null;

      const { data: version, error: insertError } = await insertVersion(content, name, source);
      if (insertError || !version) return { error: insertError ?? "Failed to save version" };

      if (options?.activate ?? true) {
        const { error: activateError } = await activateAndSync(version);
        if (activateError) {
          await refresh();
          return { error: activateError };
        }
      }

      await refresh();
      return { error: null, version };
    },
    [user, roleId, insertVersion, activateAndSync, refresh],
  );

  /** Manual edit of a version's content/name. Any content edit marks the
   * version `manual` (even if it started as `generated`) since it's no
   * longer purely AI output — a clear, consistent generated-vs-manual
   * signal for the UI. If this is the active version, `roles.cover_letter`
   * is kept in sync. */
  const updateVersion = useCallback(
    async (
      versionId: string,
      patch: { content?: string; name?: string | null },
    ): Promise<{ error: string | null }> => {
      const current = versions.find((v) => v.id === versionId);
      if (!current) return { error: "Version not found" };

      const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.content !== undefined) {
        dbPatch.content = patch.content;
        dbPatch.source = "manual";
      }
      if (patch.name !== undefined) dbPatch.name = patch.name?.trim() || null;

      const { error: updateError } = await supabase
        .from("cover_letter_versions")
        .update(dbPatch)
        .eq("id", versionId);
      if (updateError) return { error: updateError.message };

      if (current.isActive && patch.content !== undefined && roleId) {
        syncActiveCoverLetter(roleId, patch.content);
      }

      await refresh();
      return { error: null };
    },
    [versions, roleId, syncActiveCoverLetter, refresh],
  );

  const duplicateVersion = useCallback(
    async (versionId: string): Promise<{ error: string | null }> => {
      const original = versions.find((v) => v.id === versionId);
      if (!original) return { error: "Version not found" };

      const name = duplicateVersionName(original.name, original.versionNumber);
      const { error: insertError } = await insertVersion(original.content, name, "manual");
      if (insertError) return { error: insertError };

      await refresh();
      return { error: null };
    },
    [versions, insertVersion, refresh],
  );

  /** Delete a version. If it was active and other versions remain, the
   * most recent remaining version is promoted to active (never leaves a
   * role with zero active version while versions still exist). */
  const deleteVersion = useCallback(
    async (versionId: string): Promise<{ error: string | null }> => {
      const target = versions.find((v) => v.id === versionId);
      if (!target) return { error: "Version not found" };

      const { error: deleteError } = await supabase
        .from("cover_letter_versions")
        .delete()
        .eq("id", versionId);
      if (deleteError) return { error: deleteError.message };

      if (target.isActive) {
        const remaining = versions.filter((v) => v.id !== versionId);
        const promoted = pickPromotedVersion(
          remaining.map((v) => ({ id: v.id, versionNumber: v.versionNumber, updatedAt: v.updatedAt })),
        );
        if (promoted) {
          const promotedVersion = remaining.find((v) => v.id === promoted.id);
          if (promotedVersion) {
            const { error: activateError } = await activateAndSync(promotedVersion);
            if (activateError) {
              await refresh();
              return { error: activateError };
            }
          }
        }
      }

      await refresh();
      return { error: null };
    },
    [versions, activateAndSync, refresh],
  );

  const setActiveVersion = useCallback(
    async (versionId: string): Promise<{ error: string | null }> => {
      const version = versions.find((v) => v.id === versionId);
      if (!version) return { error: "Version not found" };
      const { error: activateError } = await activateAndSync(version);
      if (activateError) return { error: activateError };
      await refresh();
      return { error: null };
    },
    [versions, activateAndSync, refresh],
  );

  const activeVersion = versions.find((v) => v.isActive) ?? null;

  return {
    versions,
    activeVersion,
    loading,
    error,
    refresh,
    createVersion,
    updateVersion,
    duplicateVersion,
    deleteVersion,
    setActiveVersion,
  };
}
