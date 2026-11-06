import { useRef, useState } from "react";
import { searchJobs } from "../api";
import type { Job, JobSearchFilters } from "../../../types/jobs";

const PAGE_SIZE = 20;

/**
 * Search state for the /jobs "Search" tab, over GET /api/jobs/search (the job
 * feed). `providerConfigured: false` means search is switched off or the
 * listings could not be reached, which the page shows differently from "no
 * results matched".
 *
 * `runSearch` starts a new search from the first page; `loadMore` appends the
 * next page of the same search. A reply that arrives after a newer search has
 * started is ignored.
 */
export function useJobSearch() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const lastFilters = useRef<JobSearchFilters | null>(null);
  const latestRequest = useRef(0);

  async function run(filters: JobSearchFilters, targetPage: number, append: boolean) {
    const requestId = ++latestRequest.current;
    lastFilters.current = filters;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await searchJobs(filters, targetPage, PAGE_SIZE);
      if (requestId !== latestRequest.current) return;
      setJobs((prev) => (append ? [...prev, ...result.jobs] : result.jobs));
      setTotalCount(result.totalCount);
      setPage(result.page);
      setProviderConfigured(result.providerConfigured);
      setHasSearched(true);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      console.error("[useJobSearch] search failed:", err);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      if (requestId === latestRequest.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  function runSearch(filters: JobSearchFilters, targetPage = 1) {
    return run(filters, targetPage, false);
  }

  function loadMore() {
    if (!lastFilters.current) return Promise.resolve();
    return run(lastFilters.current, page + 1, true);
  }

  return {
    jobs,
    totalCount,
    page,
    pageSize: PAGE_SIZE,
    providerConfigured,
    loading,
    loadingMore,
    hasMore: jobs.length < totalCount,
    error,
    hasSearched,
    runSearch,
    loadMore,
  };
}
