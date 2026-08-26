import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import type { SavedResume } from "../../../types/resume";

const BUCKET = "resumes";

type ResumeRow = {
  id: string;
  name: string;
  storage_path: string;
  extracted_text: string | null;
  version: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

function rowToResume(row: ResumeRow): SavedResume {
  return {
    id: row.id,
    name: row.name,
    storagePath: row.storage_path,
    extractedText: row.extracted_text,
    version: row.version,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * CRUD + Storage upload for the `resumes` table (see
 * supabase/migrations/005_resumes.sql). Direct-to-Supabase, RLS-protected —
 * same pattern as useTracker.ts for `roles` — no backend route needed since
 * nothing here requires a secret or server-side computation.
 *
 * Versioning scope (deliberately modest): re-saving under a name that
 * already matches an existing, non-deleted resume for this user overwrites
 * that same row's file + extracted text in place and bumps `version`. There
 * is no separate version-history table and no diff/compare/restore — only
 * the latest content per name is ever retained.
 */
export function useResumes() {
  const { user } = useAuth();
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!user) {
      setResumes([]);
      return;
    }
    setLoading(true);
    supabase
      .from("resumes")
      .select("id, name, storage_path, extracted_text, version, is_default, created_at, updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          console.error("[useResumes] load failed:", err);
          setError(err.message);
        } else {
          setError(null);
          setResumes(((data as ResumeRow[] | null) ?? []).map(rowToResume));
        }
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveResume = useCallback(
    async (file: File, extractedText: string, name?: string): Promise<{ error: string | null; id?: string }> => {
      if (!user) return { error: "You must be logged in to save a resume." };
      const resumeName = (name ?? file.name ?? "Resume").trim() || "Resume";

      try {
        const { data: existingRows, error: findError } = await supabase
          .from("resumes")
          .select("id, storage_path, version")
          .eq("name", resumeName)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (findError) throw findError;
        const existing = (existingRows as { id: string; storage_path: string; version: number }[] | null)?.[0];

        if (existing) {
          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(existing.storage_path, file, { upsert: true, contentType: "application/pdf" });
          if (uploadError) throw uploadError;

          const { error: updateError } = await supabase
            .from("resumes")
            .update({
              extracted_text: extractedText,
              version: existing.version + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (updateError) throw updateError;

          refresh();
          return { error: null, id: existing.id };
        }

        const id = crypto.randomUUID();
        const storagePath = `${user.id}/${id}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, file, { upsert: false, contentType: "application/pdf" });
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from("resumes").insert({
          id,
          user_id: user.id,
          name: resumeName,
          storage_path: storagePath,
          extracted_text: extractedText,
          version: 1,
          is_default: resumes.length === 0,
        });
        if (insertError) throw insertError;

        refresh();
        return { error: null, id };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save resume";
        console.error("[useResumes] save failed:", e);
        return { error: message };
      }
    },
    [user, resumes.length, refresh],
  );

  const renameResume = useCallback(
    async (id: string, newName: string): Promise<{ error: string | null }> => {
      const trimmed = newName.trim();
      if (!trimmed) return { error: "Name cannot be empty" };
      const { error: err } = await supabase
        .from("resumes")
        .update({ name: trimmed, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (err) return { error: err.message };
      refresh();
      return { error: null };
    },
    [refresh],
  );

  const setDefaultResume = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      if (!user) return { error: "Not logged in" };
      // Two sequential updates rather than one atomic statement — RLS scopes
      // both to the caller's own rows, so the worst case on a rare failure
      // between them is "no resume marked default", not cross-user leakage.
      const { error: clearError } = await supabase.from("resumes").update({ is_default: false }).neq("id", id);
      if (clearError) return { error: clearError.message };
      const { error: setError } = await supabase.from("resumes").update({ is_default: true }).eq("id", id);
      if (setError) return { error: setError.message };
      refresh();
      return { error: null };
    },
    [user, refresh],
  );

  const deleteResume = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const { error: err } = await supabase
        .from("resumes")
        .update({ deleted_at: new Date().toISOString(), is_default: false })
        .eq("id", id);
      if (err) return { error: err.message };
      refresh();
      return { error: null };
    },
    [refresh],
  );

  const downloadResumeFile = useCallback(async (resume: SavedResume): Promise<File | null> => {
    const { data, error: err } = await supabase.storage.from(BUCKET).download(resume.storagePath);
    if (err || !data) {
      console.error("[useResumes] download failed:", err);
      return null;
    }
    return new File([data], resume.name, { type: "application/pdf" });
  }, []);

  return {
    resumes,
    loading,
    error,
    refresh,
    saveResume,
    renameResume,
    setDefaultResume,
    deleteResume,
    downloadResumeFile,
  };
}
