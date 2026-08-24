import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { useAuth } from "../context/AuthContext";

export type ProfileData = {
  fullName: string;
  major: string;
  targetRole: string;
  graduationYear: string;
};

type ProfileRow = {
  full_name: string | null;
  major: string | null;
  target_role: string | null;
  graduation_year: string | null;
};

function rowToProfile(row: ProfileRow): ProfileData {
  return {
    fullName: row.full_name ?? "",
    major: row.major ?? "",
    targetRole: row.target_role ?? "",
    graduationYear: row.graduation_year ?? "",
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
    supabase
      .from("profiles")
      .select("full_name, major, target_role, graduation_year")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
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
    const dbPatch: Record<string, string> = {};
    if (patch.fullName !== undefined) dbPatch.full_name = patch.fullName;
    if (patch.major !== undefined) dbPatch.major = patch.major;
    if (patch.targetRole !== undefined) dbPatch.target_role = patch.targetRole;
    if (patch.graduationYear !== undefined) dbPatch.graduation_year = patch.graduationYear;
    const { error } = await supabase.from("profiles").update(dbPatch).eq("id", user.id);
    if (error) console.error("[useProfile] update failed:", error);
    return { error: error?.message ?? null };
  }

  return { profile, loading, updateProfile };
}
