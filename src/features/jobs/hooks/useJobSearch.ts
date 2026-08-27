import { useState } from "react";
import { searchJobs } from "../api";
import type { Job, JobSearchFilters } from "../../../types/jobs";

const PAGE_SIZE = 20;

/**
 * Search state for the /jobs "Search" tab. Calls GET /api/jobs/search,
 * which always calls the currently active provider (server/lib/
 * jobProviders/) — today that's always NullJobProvider, so `providerConfigured`
 * comes back false and `jobs` is empty. This hook surfaces that flag as-is
 * rather than collapsing it into a generic "no results" state, so the page
 * can render the honest "not connected yet" message instead of implying the
 * search itself failed to match anything.
 */
export function useJobSearch() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function runSearch(filters: JobSearchFilters, targetPage = 1) {
    setLoading(true);
    setError(null);
    try {
      const result = await searchJobs(filters, targetPage, PAGE_SIZE);
      setJobs(result.jobs);
      setTotalCount(result.totalCount);
      setPage(result.page);
      setProviderConfigured(result.providerConfigured);
      setHasSearched(true);
    } catch (err) {
      console.error("[useJobSearch] search failed:", err);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return { jobs, totalCount, page, pageSize: PAGE_SIZE, providerConfigured, loading, error, hasSearched, runSearch };
}
