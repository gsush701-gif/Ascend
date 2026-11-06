import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { JobFilters } from "../components/jobs/JobFilters";
import { JobCard, JobCardSkeleton } from "../components/jobs/JobCard";
import { FilterChip } from "../components/jobs/FilterChip";
import { ProviderNotConfiguredBanner } from "../components/jobs/ProviderNotConfiguredBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { CareerPreferencesForm } from "../features/preferences/components/CareerPreferencesForm";
import { useJobSearch } from "../features/jobs/hooks/useJobSearch";
import { useJobRecommendations } from "../features/jobs/hooks/useJobRecommendations";
import { useSavedJobs } from "../features/jobs/hooks/useSavedJobs";
import { useDismissedJobs } from "../features/jobs/hooks/useDismissedJobs";
import { EMPTY_JOB_SEARCH_FILTERS, type JobSearchFilters } from "../types/jobs";
import { pageTitle, pageSubtitle } from "../lib/ui";
import { cn } from "../lib/cn";

type JobsTab = "recommended" | "search" | "saved";

const fmt = (n: number) => n.toLocaleString();

export function Jobs() {
  const [tab, setTab] = useState<JobsTab>("recommended");
  const [filters, setFilters] = useState<JobSearchFilters>(EMPTY_JOB_SEARCH_FILTERS);

  const search = useJobSearch();
  const recs = useJobRecommendations();
  const { savedJobIds, saveJob, unsaveJob, savedJobs, loading: savedLoading, error: savedError } = useSavedJobs();
  const { dismissedIds, dismissJob, undoDismiss } = useDismissedJobs();

  // Opening Search shows the newest postings straight away, instead of an empty page.
  const autoSearched = useRef(false);
  const { runSearch } = search;
  useEffect(() => {
    if (tab !== "search" || autoSearched.current) return;
    autoSearched.current = true;
    Promise.resolve().then(() => runSearch(EMPTY_JOB_SEARCH_FILTERS, 1));
  }, [tab, runSearch]);

  const tabs: { value: JobsTab; label: string; count?: number }[] = [
    { value: "recommended", label: "Recommended" },
    { value: "search", label: "Search" },
    { value: "saved", label: "Saved", count: savedJobs.length || undefined },
  ];

  const visibleRecs = recs.items.filter((item) => !dismissedIds.has(item.id));
  const dismissedRecs = recs.items.filter((item) => dismissedIds.has(item.id));
  const filtersOn = recs.level !== "all" || recs.remoteOnly;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-5 pb-12">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-xl">
            <h1 className={pageTitle}>Jobs</h1>
            <p className={pageSubtitle}>
              Internships and new-grad roles from companies' own career pages, refreshed daily. You apply on the
              company's site.
            </p>
          </div>
          {recs.counts.all > 0 && (
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              {fmt(recs.counts.all)} open roles
            </div>
          )}
        </header>

        <nav className="flex gap-1 border-b border-slate-200" aria-label="Jobs sections">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-current={tab === t.value ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition",
                tab === t.value
                  ? "border-cyan-500 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
              {t.count !== undefined && <span className="ml-1.5 text-xs text-slate-400">{t.count}</span>}
            </button>
          ))}
        </nav>

        {tab === "recommended" && (
          <div className="space-y-4">
            {!recs.hasResumeOnFile && !recs.loading && !recs.error && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span>Add your resume to see how well each role fits your skills.</span>
                <Link to="/resumes" className="font-semibold underline hover:text-amber-950">
                  Add resume
                </Link>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <FilterChip active={recs.level === "all"} onClick={() => recs.setLevel("all")} count={recs.counts.all}>
                All
              </FilterChip>
              <FilterChip
                active={recs.level === "Internship"}
                onClick={() => recs.setLevel("Internship")}
                count={recs.counts.internship}
              >
                Internships
              </FilterChip>
              <FilterChip active={recs.level === "Entry"} onClick={() => recs.setLevel("Entry")} count={recs.counts.entry}>
                New grad
              </FilterChip>
              <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
              <FilterChip active={recs.remoteOnly} onClick={() => recs.setRemoteOnly(!recs.remoteOnly)} count={recs.counts.remote}>
                Remote
              </FilterChip>
              {!recs.loading && recs.total > 0 && (
                <span className="ml-auto text-xs text-slate-500">
                  Showing {fmt(recs.items.length)} of {fmt(recs.total)}, best match first
                </span>
              )}
            </div>

            {recs.error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {recs.error}{" "}
                <button type="button" onClick={recs.reload} className="font-semibold underline">
                  Try again
                </button>
              </div>
            )}

            {recs.loading ? (
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <JobCardSkeleton key={i} />
                ))}
              </div>
            ) : visibleRecs.length === 0 && !recs.error ? (
              <EmptyState
                title={recs.counts.all === 0 ? "No open roles yet" : "Nothing matches these filters"}
                subtitle={
                  recs.counts.all === 0
                    ? "Listings come from companies' own career pages and refresh once a day, so check back soon."
                    : "Try a different level, or turn off the Remote filter."
                }
                primaryAction={
                  filtersOn
                    ? {
                        label: "Clear filters",
                        onClick: () => {
                          recs.setLevel("all");
                          recs.setRemoteOnly(false);
                        },
                      }
                    : { label: "Search all roles", onClick: () => setTab("search") }
                }
                compact
              />
            ) : (
              <div className="space-y-3">
                {visibleRecs.map((item) => (
                  <JobCard
                    key={item.id}
                    job={item}
                    match={item.match}
                    saved={savedJobIds.has(item.id)}
                    onSave={() => saveJob(item.id)}
                    onUnsave={() => unsaveJob(item.id)}
                    onDismiss={() => dismissJob(item.id)}
                  />
                ))}
              </div>
            )}

            {!recs.loading && recs.hasMore && (
              <div className="flex justify-center pt-1">
                <Button variant="secondary" onClick={recs.loadMore} disabled={recs.loadingMore}>
                  {recs.loadingMore ? "Loading…" : `Show more (${fmt(recs.total - recs.items.length)} left)`}
                </Button>
              </div>
            )}

            {dismissedRecs.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Not interested</div>
                {dismissedRecs.map((item) => (
                  <JobCard key={item.id} job={item} dismissed onUndoDismiss={() => undoDismiss(item.id)} />
                ))}
              </div>
            )}

            <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Tune your matches
                <span className="ml-2 font-normal text-slate-500">
                  work authorization, sponsorship and the places you want to work
                </span>
              </summary>
              <div className="mt-4">
                <CareerPreferencesForm />
              </div>
            </details>
          </div>
        )}

        {tab === "search" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-dash-card p-4 shadow-sm">
              <JobFilters
                filters={filters}
                onChange={setFilters}
                onSearch={(next) => search.runSearch(next ?? filters, 1)}
                loading={search.loading}
              />
            </div>

            {search.error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {search.error}
              </div>
            )}

            {!search.hasSearched || (search.loading && search.jobs.length === 0) ? (
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <JobCardSkeleton key={i} />
                ))}
              </div>
            ) : search.providerConfigured === false ? (
              <ProviderNotConfiguredBanner />
            ) : search.jobs.length === 0 ? (
              <EmptyState
                title="No roles match that search"
                subtitle="Try fewer filters, or a broader word like “engineer” or “data”."
                primaryAction={{
                  label: "Clear filters",
                  onClick: () => {
                    setFilters(EMPTY_JOB_SEARCH_FILTERS);
                    void search.runSearch(EMPTY_JOB_SEARCH_FILTERS, 1);
                  },
                }}
                compact
              />
            ) : (
              <>
                <div className="text-xs text-slate-500">
                  {fmt(search.totalCount)} {search.totalCount === 1 ? "role" : "roles"}, newest first
                </div>
                <div className="space-y-3">
                  {search.jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      saved={savedJobIds.has(job.id)}
                      onSave={() => saveJob(job.id)}
                      onUnsave={() => unsaveJob(job.id)}
                    />
                  ))}
                </div>
                {search.hasMore && (
                  <div className="flex justify-center pt-1">
                    <Button variant="secondary" onClick={() => void search.loadMore()} disabled={search.loadingMore}>
                      {search.loadingMore
                        ? "Loading…"
                        : `Show more (${fmt(search.totalCount - search.jobs.length)} left)`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "saved" && (
          <div className="space-y-3">
            {savedError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {savedError}
              </div>
            )}
            {savedLoading ? (
              <div className="space-y-3" aria-busy="true">
                {[0, 1].map((i) => (
                  <JobCardSkeleton key={i} />
                ))}
              </div>
            ) : savedJobs.length === 0 ? (
              <EmptyState
                title="No saved roles yet"
                subtitle="Press Save on a role to keep it here and come back to it."
                primaryAction={{ label: "See recommended roles", onClick: () => setTab("recommended") }}
                compact
              />
            ) : (
              savedJobs.map((job) => (
                <JobCard key={job.id} job={job} saved savedAt={job.savedAt} onUnsave={() => unsaveJob(job.id)} />
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
