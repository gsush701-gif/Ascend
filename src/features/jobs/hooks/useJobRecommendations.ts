import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { fetchJobRecommendations, type JobCounts } from "../api";
import type { RecommendedJob } from "../../../types/jobs";

const PAGE_SIZE = 20;

export type RecommendationLevel = "all" | "Internship" | "Entry";

const NO_COUNTS: JobCounts = { all: 0, internship: 0, entry: 0, remote: 0 };

/**
 * Recommendations for the /jobs "Recommended" tab: open postings from the job
 * feed, scored against the student's resume and preferences by
 * GET /api/jobs/recommendations, best match first.
 *
 * `level` and `remoteOnly` narrow the list on the server; changing either
 * starts again from the first page. "Show more" appends the next page. A reply
 * that arrives after the filters have changed again is ignored.
 */
export function useJobRecommendations() {
  const { user, session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const [items, setItems] = useState<RecommendedJob[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<JobCounts>(NO_COUNTS);
  const [hasResumeOnFile, setHasResumeOnFile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<RecommendationLevel>("all");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [page, setPage] = useState(1);
  const latestRequest = useRef(0);

  const load = useCallback(
    (targetPage: number, append: boolean) => {
      if (authLoading) return;
      if (!user || !token) {
        setItems([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      const requestId = ++latestRequest.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      fetchJobRecommendations(token, targetPage, PAGE_SIZE, {
        level: level === "all" ? null : level,
        remoteOnly,
      })
        .then((result) => {
          if (requestId !== latestRequest.current) return;
          setItems((prev) => (append ? [...prev, ...result.items] : result.items));
          setTotal(result.total);
          setCounts(result.counts);
          setHasResumeOnFile(result.hasResumeOnFile);
          setPage(result.page);
          setError(null);
        })
        .catch((err) => {
          if (requestId !== latestRequest.current) return;
          console.error("[useJobRecommendations] load failed:", err);
          setError(err instanceof Error ? err.message : "Failed to load recommendations");
        })
        .finally(() => {
          if (requestId !== latestRequest.current) return;
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [authLoading, user, token, level, remoteOnly],
  );

  useEffect(() => {
    // Deferred to a microtask: avoids React's set-state-in-effect cascading-render warning.
    Promise.resolve().then(() => load(1, false));
  }, [load]);

  const loadMore = useCallback(() => load(page + 1, true), [load, page]);
  const reload = useCallback(() => load(1, false), [load]);

  return {
    items,
    total,
    counts,
    hasResumeOnFile,
    loading,
    loadingMore,
    hasMore: items.length < total,
    error,
    level,
    setLevel,
    remoteOnly,
    setRemoteOnly,
    loadMore,
    reload,
  };
}
