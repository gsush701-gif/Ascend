import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { JobFilters } from "../components/jobs/JobFilters";
import { JobCard } from "../components/jobs/JobCard";
import { ProviderNotConfiguredBanner } from "../components/jobs/ProviderNotConfiguredBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { useJobSearch } from "../features/jobs/hooks/useJobSearch";
import { useJobRecommendations } from "../features/jobs/hooks/useJobRecommendations";
import { useSavedJobs } from "../features/jobs/hooks/useSavedJobs";
import { useDismissedJobs } from "../features/jobs/hooks/useDismissedJobs";
import { EMPTY_JOB_SEARCH_FILTERS, type JobSearchFilters } from "../types/jobs";
import { pageHeader, pageTitle, pageSubtitle, card } from "../lib/ui";
import { cn } from "../lib/cn";

type JobsTab = "search" | "recommendations" | "saved";

const TABS: { value: JobsTab; label: string }[] = [
  { value: "search", label: "Search" },
  { value: "recommendations", label: "Recommendations" },
  { value: "saved", label: "Saved" },
];

export function Jobs() {
  const [tab, setTab] = useState<JobsTab>("recommendations");
  const [filters, setFilters] = useState<JobSearchFilters>(EMPTY_JOB_SEARCH_FILTERS);

  const search = useJobSearch();
  const recommendations = useJobRecommendations();
  const { savedJobIds, saveJob, unsaveJob, savedJobs, loading: savedLoading, error: savedError } = useSavedJobs();
  const { dismissedIds, dismissJob, undoDismiss } = useDismissedJobs();

  return (
    <AppShell>
      <div className="space-y-6">
        <header className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Jobs</h1>
            <p className={pageSubtitle}>
              Search live listings once a provider is connected, see recommendations scored against your own
              profile, and keep track of the ones worth revisiting.
            </p>
          </div>
        </header>

        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                tab === t.value
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-[#FFFFFF] text-slate-600 hover:bg-slate-900/[0.04]",
              )}
            >
              {t.label}
              {t.value === "saved" && savedJobs.length > 0 ? ` (${savedJobs.length})` : ""}
            </button>
          ))}
        </div>

        {tab === "search" && (
          <div className="space-y-4">
            <div className={card}>
              <JobFilters filters={filters} onChange={setFilters} onSearch={() => search.runSearch(filters, 1)} loading={search.loading} />
            </div>

            {search.error && (
              <div className={`${card} border-rose-200 bg-rose-50 text-sm text-rose-700`}>{search.error}</div>
            )}

            {!search.hasSearched ? (
              <div className={`${card} py-10 text-center text-sm text-slate-500`}>
                Enter a keyword, location, or filter above and hit Search.
              </div>
            ) : search.providerConfigured === false ? (
              <ProviderNotConfiguredBanner />
            ) : search.jobs.length === 0 ? (
              <div className={`${card} py-10 text-center text-sm text-slate-500`}>
                No listings matched your filters.
              </div>
            ) : (
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
            )}
          </div>
        )}

        {tab === "recommendations" && (
          <div className="space-y-3">
            {recommendations.error && (
              <div className={`${card} border-rose-200 bg-rose-50 text-sm text-rose-700`}>{recommendations.error}</div>
            )}

            {!recommendations.hasResumeOnFile && !recommendations.loading && (
              <div className={`${card} border-amber-200 bg-amber-50 text-sm text-amber-800`}>
                Upload a resume to get skill-matched recommendations — without one, matching can only use your
                profile's location/sponsorship preferences.
              </div>
            )}

            {recommendations.loading ? (
              <div className="grid gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`${card} h-40 animate-pulse`} />
                ))}
              </div>
            ) : recommendations.items.length === 0 ? (
              <div className={`${card} py-12 text-center`}>
                <h3 className="text-lg font-semibold text-slate-900">No recommendations yet</h3>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
                  Ascend doesn't have a live job-listing provider connected yet, so there are no postings in the
                  system to score against your profile. This is expected — recommendations will appear here
                  automatically once real listings exist.
                </p>
              </div>
            ) : (
              recommendations.items
                .filter((item) => !dismissedIds.has(item.id))
                .map((item) => (
                  <JobCard
                    key={item.id}
                    job={item}
                    match={item.match}
                    saved={savedJobIds.has(item.id)}
                    onSave={() => saveJob(item.id)}
                    onUnsave={() => unsaveJob(item.id)}
                    onDismiss={() => dismissJob(item.id)}
                  />
                ))
            )}

            {Array.from(dismissedIds).length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Dismissed</div>
                {recommendations.items
                  .filter((item) => dismissedIds.has(item.id))
                  .map((item) => (
                    <JobCard key={item.id} job={item} dismissed onUndoDismiss={() => undoDismiss(item.id)} />
                  ))}
              </div>
            )}
          </div>
        )}

        {tab === "saved" && (
          <div className="space-y-3">
            {savedError && (
              <div className={`${card} border-rose-200 bg-rose-50 text-sm text-rose-700`}>{savedError}</div>
            )}
            {savedLoading ? (
              <div className="grid gap-3">
                {[0, 1].map((i) => (
                  <div key={i} className={`${card} h-32 animate-pulse`} />
                ))}
              </div>
            ) : savedJobs.length === 0 ? (
              <EmptyState
                title="No saved jobs yet"
                subtitle="Save a listing from Search or Recommendations to keep track of it here."
                primaryAction={{ label: "Go to Recommendations", onClick: () => setTab("recommendations") }}
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
