import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

/**
 * Dismissing a job: a plain direct Supabase write against the per-user
 * RLS-protected `dismissed_jobs` table (020_job_discovery.sql) — same
 * pattern as useContacts.ts / useSavedJobs.ts's writes. No read/listing
 * endpoint is needed for this table: GET /api/jobs/recommendations already
 * excludes a user's dismissed jobs server-side, and "Undo" only ever needs
 * the single job id that was just dismissed (kept in local state here), not
 * a full dismissed-jobs history view.
 */
export function useDismissedJobs() {
  const { user } = useAuth();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function dismissJob(jobId: string) {
    if (!user) {
      setError("You must be logged in to dismiss a job.");
      return;
    }
    setDismissedIds((prev) => new Set(prev).add(jobId));
    const { error: insertError } = await supabase
      .from("dismissed_jobs")
      .insert({ user_id: user.id, job_id: jobId });
    if (insertError && insertError.code !== "23505") {
      console.error("[useDismissedJobs] dismiss failed:", insertError);
      setError(insertError.message);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  }

  async function undoDismiss(jobId: string) {
    if (!user) return;
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
    const { error: deleteError } = await supabase
      .from("dismissed_jobs")
      .delete()
      .eq("user_id", user.id)
      .eq("job_id", jobId);
    if (deleteError) {
      console.error("[useDismissedJobs] undo dismiss failed:", deleteError);
      setError(deleteError.message);
    }
  }

  return { dismissedIds, error, dismissJob, undoDismiss };
}
