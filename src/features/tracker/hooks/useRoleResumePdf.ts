import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import type { TrackerItem } from "../../../types/tracker";

const BUCKET = "role-resumes";

/**
 * Upload/view/remove the resume PDF attached to one tracked role (see
 * supabase/migrations/026_role_resume_pdf.sql) — the Role report page's
 * drag-and-drop PDF viewer. Deliberately separate from useResumes.ts (the
 * account-wide saved-resumes list): this is one file scoped to a single
 * role, upserted in place, not added to that reusable list. When set, this
 * is the resume "Analyze this role" (RoleDetail.tsx's runAnalyze) scores
 * against instead of your default saved resume.
 */
export function useRoleResumePdf(
  roleId: string,
  resumeStoragePath: string | undefined,
  updateRoleFields: (id: string, fields: Partial<TrackerItem>) => void,
) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const revokeCurrent = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  // Downloads + renders whenever the persisted path changes — including on
  // mount, and right after a fresh upload sets it.
  useEffect(() => {
    let cancelled = false;
    revokeCurrent();
    setObjectUrl(null);
    if (!resumeStoragePath) return;

    supabase.storage
      .from(BUCKET)
      .download(resumeStoragePath)
      .then(({ data, error: downloadError }) => {
        if (cancelled) return;
        if (downloadError || !data) {
          setError(downloadError?.message ?? "Failed to load the resume");
          return;
        }
        const url = URL.createObjectURL(data);
        objectUrlRef.current = url;
        setObjectUrl(url);
      });

    return () => {
      cancelled = true;
    };
  }, [resumeStoragePath, revokeCurrent]);

  // Revoke on unmount too, not just when the path changes.
  useEffect(() => revokeCurrent, [revokeCurrent]);

  const upload = useCallback(
    async (file: File): Promise<{ error: string | null }> => {
      if (!user) return { error: "You must be logged in." };
      if (file.type !== "application/pdf") {
        const message = "Only PDF files are supported.";
        setError(message);
        return { error: message };
      }
      setUploading(true);
      setError(null);
      try {
        const previousPath = resumeStoragePath;
        // A fresh, unique path per upload — never overwrite the same path
        // in place. Supabase Storage objects are cache-control'd (1 hour by
        // default), so re-uploading to the *same* path could still serve a
        // stale cached copy on a later page load/reload even though the
        // object was genuinely overwritten — a real bug this app hit.
        // A new path every time makes that class of bug impossible, and
        // also means resumeStoragePath genuinely changes value on every
        // replace, so the path-keyed effect above correctly re-fires on
        // reload/remount too, not just within the same session.
        const path = `${user.id}/${roleId}-${crypto.randomUUID()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: "application/pdf", cacheControl: "0" });
        if (uploadError) throw uploadError;
        updateRoleFields(roleId, { resumeStoragePath: path });
        // Render the freshly-uploaded file directly rather than waiting on
        // the path-keyed effect to re-download what we already have in hand.
        revokeCurrent();
        const url = URL.createObjectURL(file);
        objectUrlRef.current = url;
        setObjectUrl(url);
        // Clean up the previous file now that the new one is confirmed
        // saved — best-effort; a failure here shouldn't fail the upload
        // the user is actually waiting on.
        if (previousPath && previousPath !== path) {
          void supabase.storage.from(BUCKET).remove([previousPath]);
        }
        return { error: null };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to upload the resume";
        setError(message);
        return { error: message };
      } finally {
        setUploading(false);
      }
    },
    [user, roleId, updateRoleFields, revokeCurrent, resumeStoragePath],
  );

  const remove = useCallback(async (): Promise<{ error: string | null }> => {
    if (!resumeStoragePath) return { error: null };
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([resumeStoragePath]);
    if (removeError) {
      setError(removeError.message);
      return { error: removeError.message };
    }
    updateRoleFields(roleId, { resumeStoragePath: undefined });
    return { error: null };
  }, [resumeStoragePath, roleId, updateRoleFields]);

  return { uploading, error, objectUrl, upload, remove };
}
