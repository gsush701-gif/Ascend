import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { useAuth } from "../context/AuthContext";

export type ProfileData = {
  fullName: string;
  major: string;
  targetRole: string;
  graduationYear: string;
  // --- Phase 5 "career preferences" fields (all additive/optional) ---
  /** Free-text work authorization status, e.g. "US Citizen", "F-1 OPT", "H-1B". */
  workAuthorization: string;
  /** Whether the user requires visa sponsorship. Undefined = not specified. */
  requiresSponsorship: boolean | undefined;
  /** Free-text preferred location(s), e.g. "Seattle, WA; Remote". */
  preferredLocations: string;
  /** e.g. "Remote", "Hybrid", "Onsite", "No preference". */
  remotePreference: string;
};

type ProfileRow = {
  full_name: string | null;
  major: string | null;
  target_role: string | null;
  graduation_year: string | null;
  work_authorization: string | null;
  requires_sponsorship: boolean | null;
  preferred_locations: string | null;
  remote_preference: string | null;
};

function rowToProfile(row: ProfileRow): ProfileData {
  return {
    fullName: row.full_name ?? "",
    major: row.major ?? "",
    targetRole: row.target_role ?? "",
    graduationYear: row.graduation_year ?? "",
    workAuthorization: row.work_authorization ?? "",
    requiresSponsorship: row.requires_sponsorship ?? undefined,
    preferredLocations: row.preferred_locations ?? "",
    remotePreference: row.remote_preference ?? "",
  };
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    // Try the full column set (including the Phase 5 "career preferences"
    // columns from migration 014) first. If that migration hasn't been
    // applied to this environment yet, Postgres returns a plain "column
    // does not exist" error (42703) for the WHOLE select — without a
    // fallback, that would break the pre-existing major/targetRole/
    // graduationYear fields too, not just the new ones. So on exactly that
    // error, retry with just the original, always-present columns rather
    // than surfacing a broken Identity panel until someone runs the
    // migration.
    const FULL_COLUMNS =
      "full_name, major, target_role, graduation_year, work_authorization, requires_sponsorship, preferred_locations, remote_preference";
    const BASE_COLUMNS = "full_name, major, target_role, graduation_year";

    supabase
      .from("profiles")
      .select(FULL_COLUMNS)
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          if (error.code === "42703") {
            supabase
              .from("profiles")
              .select(BASE_COLUMNS)
              .eq("id", user.id)
              .maybeSingle()
              .then(({ data: baseData, error: baseError }) => {
                if (cancelled) return;
                if (baseError) {
                  console.error("[useProfile] load failed:", baseError);
                  setLoading(false);
                  return;
                }
                setProfile(
                  baseData ? rowToProfile(baseData as ProfileRow) : rowToProfile({} as ProfileRow)
                );
                setLoading(false);
              });
            return;
          }
          console.error("[useProfile] load failed:", error);
          setLoading(false);
          return;
        }
        setProfile(data ? rowToProfile(data as ProfileRow) : rowToProfile({} as ProfileRow));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function updateProfile(patch: Partial<ProfileData>): Promise<{ error: string | null }> {
    if (!user) return { error: "Not logged in" };
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
    const dbPatch: Record<string, string | boolean | null> = {};
    if (patch.fullName !== undefined) dbPatch.full_name = patch.fullName;
    if (patch.major !== undefined) dbPatch.major = patch.major;
    if (patch.targetRole !== undefined) dbPatch.target_role = patch.targetRole;
    if (patch.graduationYear !== undefined) dbPatch.graduation_year = patch.graduationYear;
    if (patch.workAuthorization !== undefined) dbPatch.work_authorization = patch.workAuthorization;
    if (patch.requiresSponsorship !== undefined) dbPatch.requires_sponsorship = patch.requiresSponsorship;
    if (patch.preferredLocations !== undefined) dbPatch.preferred_locations = patch.preferredLocations;
    if (patch.remotePreference !== undefined) dbPatch.remote_preference = patch.remotePreference;
    const { error } = await supabase.from("profiles").update(dbPatch).eq("id", user.id);
    if (error) console.error("[useProfile] update failed:", error);
    return { error: error?.message ?? null };
  }

  return { profile, loading, updateProfile };
}
