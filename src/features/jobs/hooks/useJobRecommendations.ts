import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { fetchJobRecommendations } from "../api";
import type { RecommendedJob } from "../../../types/jobs";

const PAGE_SIZE = 20;

/**
 * Recommendations state for the /jobs "Recommendations" tab. Calls
 * GET /api/jobs/recommendations, which scores whatever rows currently exist
 * in the shared `jobs` table (server/lib/jobMatching.js, reusing
 * server/lib/scoring.js) — honestly empty today since no job-listing
 * provider is configured, ready the moment real rows exist.
 */
export function useJobRecommendations() {
  const { user, session, loading: authLoading } = useAuth();
  const [items, setItems] = useState<RecommendedJob[]>([]);
  const [total, setTotal] = useState(0);
  const [hasResumeOnFile, setHasResumeOnFile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    const token = session?.access_token;
    if (authLoading) return;
    if (!user || !token) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchJobRecommendations(token, 1, PAGE_SIZE)
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
        setHasResumeOnFile(result.hasResumeOnFile);
        setError(null);
      })
      .catch((err) => {
        console.error("[useJobRecommendations] load failed:", err);
        setError(err instanceof Error ? err.message : "Failed to load recommendations");
      })
      .finally(() => setLoading(false));
  }, [authLoading, user, session?.access_token]);

  useEffect(() => {
    // Deferred to a microtask — see useSavedJobs.ts's identical comment for
    // why (avoids React's set-state-in-effect cascading-render warning).
    Promise.resolve().then(() => reload());
  }, [reload]);

  return { items, total, hasResumeOnFile, loading, error, reload };
}
