import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { fetchSavedJobs } from "../api";
import type { SavedJob } from "../../../types/jobs";

/**
 * Saved jobs: WRITES (save/unsave) are plain direct Supabase calls against
 * the per-user RLS-protected `saved_jobs` table (supabase/migrations/
 * 020_job_discovery.sql) — same pattern as useContacts.ts. The READ is the
 * one exception in this feature that goes through a backend route
 * (GET /api/jobs/saved) instead: `jobs` itself has zero RLS policies by
 * design (009_jobs.sql), so a client-side `saved_jobs.select("*, jobs(*)")`
 * embed would always come back with `jobs: null` — the join has to happen
 * server-side, with the service-role client, see server/index.js.
 */
export function useSavedJobs() {
  const { user, session } = useAuth();
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    const token = session?.access_token;
    if (!user || !token) {
      setSavedJobs([]);
      setSavedJobIds(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchSavedJobs(token)
      .then((jobs) => {
        setSavedJobs(jobs);
        setSavedJobIds(new Set(jobs.map((j) => j.id)));
        setError(null);
      })
      .catch((err) => {
        console.error("[useSavedJobs] load failed:", err);
        setError(err instanceof Error ? err.message : "Failed to load saved jobs");
      })
      .finally(() => setLoading(false));
  }, [user, session?.access_token]);

  useEffect(() => {
    // Deferred to a microtask (rather than calling reload() — which sets
    // state synchronously — directly in the effect body) to avoid React's
    // set-state-in-effect cascading-render warning, the same workaround
    // already used elsewhere in this codebase (see useIsAdmin.ts).
    Promise.resolve().then(() => reload());
  }, [reload]);

  async function saveJob(jobId: string) {
    if (!user) {
      setError("You must be logged in to save a job.");
      return;
    }
    setSavedJobIds((prev) => new Set(prev).add(jobId));
    const { error: insertError } = await supabase
      .from("saved_jobs")
      .insert({ user_id: user.id, job_id: jobId });
    if (insertError) {
      // Duplicate (already saved) is not a real failure — the unique
      // (user_id, job_id) constraint just means the optimistic state above
      // was already correct.
      if (insertError.code !== "23505") {
        console.error("[useSavedJobs] save failed:", insertError);
        setError(insertError.message);
        setSavedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
        return;
      }
    }
    reload();
  }

  async function unsaveJob(jobId: string) {
    if (!user) return;
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
    setSavedJobs((prev) => prev.filter((j) => j.id !== jobId));
    const { error: deleteError } = await supabase
      .from("saved_jobs")
      .delete()
      .eq("user_id", user.id)
      .eq("job_id", jobId);
    if (deleteError) {
      console.error("[useSavedJobs] unsave failed:", deleteError);
      setError(deleteError.message);
      reload();
    }
  }

  return { savedJobs, savedJobIds, loading, error, saveJob, unsaveJob, reload };
}
