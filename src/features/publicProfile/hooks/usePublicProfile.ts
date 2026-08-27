import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import type { PublicProfileSettings } from "../../../types/publicProfile";
import {
  generateDefaultSlug,
  generateRandomSlug,
  normalizeAndValidateSlug,
  extractEmailLocalPart,
} from "../../../lib/publicProfileSlug";

const UNIQUE_VIOLATION = "23505";
const MAX_SLUG_ATTEMPTS = 5;

type Row = {
  slug: string;
  is_public: boolean;
  show_skills: boolean;
  show_alignment_history: boolean;
  show_target_role: boolean;
};

function rowToSettings(row: Row): PublicProfileSettings {
  return {
    slug: row.slug,
    isPublic: row.is_public,
    showSkills: row.show_skills,
    showAlignmentHistory: row.show_alignment_history,
    showTargetRole: row.show_target_role,
  };
}

/**
 * Direct-to-Supabase CRUD on `public_profiles` (supabase/migrations/
 * 017_public_profiles.sql), RLS-scoped to the caller's own row — same
 * pattern as useResumes.ts/useTracker.ts. Only the public *read* path
 * (GET /api/public-profile/:slug, used by the /u/:slug viewer route) is
 * backend-mediated, since that one crosses user boundaries; everything here
 * is the owner managing their own row and needs no backend involvement.
 *
 * Lazily creates a default (private) row with an auto-generated slug the
 * first time this hook runs for a user who doesn't have one yet, so the
 * Profile page's sharing panel always has something to show/edit rather
 * than a separate empty state.
 *
 * @param seedName optional display name (e.g. the user's profile full name)
 * used to derive a more personal default slug than the email local part.
 */
export function usePublicProfile(seedName?: string) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PublicProfileSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const seed = (seedName && seedName.trim() && seedName !== "Not specified"
    ? seedName
    : user?.email
      ? extractEmailLocalPart(user.email)
      : "user"
  ).trim();

  const createDefaultRow = useCallback(async (): Promise<Row | null> => {
    if (!user) return null;
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = generateDefaultSlug(attempt === 0 ? seed : `${seed}-${attempt}`);
      const { data, error: insertError } = await supabase
        .from("public_profiles")
        .insert({ user_id: user.id, slug, is_public: false })
        .select("slug, is_public, show_skills, show_alignment_history, show_target_role")
        .single();
      if (!insertError && data) return data as Row;
      if (insertError && insertError.code !== UNIQUE_VIOLATION) {
        console.error("[usePublicProfile] create failed:", insertError.message);
        return null;
      }
      // 23505 (slug taken) — loop and try another random suffix.
    }
    console.error("[usePublicProfile] could not find a free slug after", MAX_SLUG_ATTEMPTS, "attempts");
    return null;
  }, [user, seed]);

  const refresh = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("public_profiles")
      .select("slug, is_public, show_skills, show_alignment_history, show_target_role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("[usePublicProfile] load failed:", fetchError.message);
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    if (data) {
      setSettings(rowToSettings(data as Row));
      setLoading(false);
      return;
    }

    const created = await createDefaultRow();
    setSettings(created ? rowToSettings(created) : null);
    if (!created) setError("Could not set up your shareable profile. Please try again.");
    setLoading(false);
  }, [user, createDefaultRow]);

  useEffect(() => {
    refresh();
    // Only re-run when the user identity changes — `seed` intentionally
    // excluded so an in-progress name edit elsewhere doesn't re-trigger a
    // fetch/create cycle for a row that already exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const updateSlug = useCallback(
    async (rawSlug: string): Promise<{ error: string | null }> => {
      if (!user) return { error: "Not logged in" };
      const result = normalizeAndValidateSlug(rawSlug);
      if (!result.valid) return { error: result.reason };
      const { slug } = result;

      setSaving(true);
      const { error: updateError } = await supabase
        .from("public_profiles")
        .update({ slug, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      setSaving(false);

      if (updateError) {
        if (updateError.code === UNIQUE_VIOLATION) {
          return { error: "This slug is already taken. Try another." };
        }
        return { error: updateError.message };
      }
      setSettings((prev) => (prev ? { ...prev, slug } : prev));
      return { error: null };
    },
    [user],
  );

  const regenerateSlug = useCallback(async (): Promise<{ error: string | null; slug?: string }> => {
    if (!user) return { error: "Not logged in" };
    setSaving(true);
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = generateRandomSlug();
      const { error: updateError } = await supabase
        .from("public_profiles")
        .update({ slug, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (!updateError) {
        setSaving(false);
        setSettings((prev) => (prev ? { ...prev, slug } : prev));
        return { error: null, slug };
      }
      if (updateError.code !== UNIQUE_VIOLATION) {
        setSaving(false);
        return { error: updateError.message };
      }
    }
    setSaving(false);
    return { error: "Could not generate a unique slug. Please try again." };
  }, [user]);

  const setIsPublic = useCallback(
    async (isPublic: boolean): Promise<{ error: string | null }> => {
      if (!user) return { error: "Not logged in" };
      setSaving(true);
      const { error: updateError } = await supabase
        .from("public_profiles")
        .update({ is_public: isPublic, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      setSaving(false);
      if (updateError) return { error: updateError.message };
      setSettings((prev) => (prev ? { ...prev, isPublic } : prev));
      return { error: null };
    },
    [user],
  );

  const setVisibilityField = useCallback(
    async (
      field: "showSkills" | "showAlignmentHistory" | "showTargetRole",
      value: boolean,
    ): Promise<{ error: string | null }> => {
      if (!user) return { error: "Not logged in" };
      const column =
        field === "showSkills"
          ? "show_skills"
          : field === "showAlignmentHistory"
            ? "show_alignment_history"
            : "show_target_role";
      setSaving(true);
      const { error: updateError } = await supabase
        .from("public_profiles")
        .update({ [column]: value, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      setSaving(false);
      if (updateError) return { error: updateError.message };
      setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
      return { error: null };
    },
    [user],
  );

  const shareUrl =
    settings && typeof window !== "undefined" ? `${window.location.origin}/u/${settings.slug}` : "";

  return {
    settings,
    loading,
    error,
    saving,
    shareUrl,
    updateSlug,
    regenerateSlug,
    setIsPublic,
    setVisibilityField,
    refresh,
  };
}
