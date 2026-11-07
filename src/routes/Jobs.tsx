import { useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { JobFilters } from "../components/jobs/JobFilters";
import { JobsHero } from "../components/jobs/JobsHero";
import { JobCard, JobCardSkeleton } from "../components/jobs/JobCard";
import { LoadingNote } from "../components/jobs/LoadingNote";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { CareerPreferencesForm } from "../features/preferences/components/CareerPreferencesForm";
import { useJobRecommendations } from "../features/jobs/hooks/useJobRecommendations";
import { useSavedJobs } from "../features/jobs/hooks/useSavedJobs";
import { useDismissedJobs } from "../features/jobs/hooks/useDismissedJobs";
import { EMPTY_JOB_SEARCH_FILTERS, type JobSearchFilters } from "../types/jobs";
import { cn } from "../lib/cn";

type JobsTab = "recommended" | "saved";

const fmt = (n: number) => n.toLocaleString();

/** The same filter card as the public internships page, in a white panel above the list. */
function FilterCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-dash-card p-4 shadow-sm">{children}</div>;
}

export function Jobs() {
  const [tab, setTab] = useState<JobsTab>("recommended");
  // What the student has typed so far in the filter card; it is applied when they search.
  const [recsDraft, setRecsDraft] = useState<JobSearchFilters>(EMPTY_JOB_SEARCH_FILTERS);

  const recs = useJobRecommendations();
  const { savedJobIds, saveJob, unsaveJob, savedJobs, loading: savedLoading, error: savedError } = useSavedJobs();
  const { dismissedIds, dismissJob, undoDismiss } = useDismissedJobs();

  const tabs: { value: JobsTab; label: string; count?: number }[] = [
    { value: "recommended", label: "Recommended" },
    { value: "saved", label: "Saved", count: savedJobs.length || undefined },
  ];

  const visibleRecs = recs.items.filter((item) => !dismissedIds.has(item.id));
  const dismissedRecs = recs.items.filter((item) => dismissedIds.has(item.id));
  const recsFiltered = JSON.stringify(recs.filters) !== JSON.stringify(EMPTY_JOB_SEARCH_FILTERS);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <JobsHero
          count={recs.counts.all}
          title="Internships and new-grad roles, ranked for you"
          subtitle="Straight from company career pages, updated daily. Each role is scored against your resume, and you apply on the company's own site."
        />

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

            <FilterCard>
              <JobFilters
                filters={recsDraft}
                onChange={setRecsDraft}
                onSearch={(next) => recs.applyFilters(next ?? recsDraft)}
                loading={recs.loading}
              />
            </FilterCard>

            {!recs.loading && recs.total > 0 && (
              <div className="text-xs text-slate-500">
                Showing {fmt(recs.items.length)} of {fmt(recs.total)}
                {recsFiltered ? " that match" : ""}, best match first
              </div>
            )}

            {recs.error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {recs.error}{" "}
                <button type="button" onClick={recs.reload} className="font-semibold underline">
                  Try again
                </button>
              </div>
            )}

            {recs.loading ? (
              <div className="space-y-4" aria-busy="true">
                <LoadingNote label="Loading your matches…" />
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <JobCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            ) : visibleRecs.length === 0 && !recs.error ? (
              <EmptyState
                title={recs.counts.all === 0 ? "No open roles yet" : "Nothing matches these filters"}
                subtitle={
                  recs.counts.all === 0
                    ? "Listings come from companies' own career pages and refresh once a day, so check back soon."
                    : "Try fewer filters, or a broader word like “engineer” or “data”."
                }
                primaryAction={
                  recsFiltered
                    ? {
                        label: "Clear filters",
                        onClick: () => {
                          setRecsDraft(EMPTY_JOB_SEARCH_FILTERS);
                          recs.applyFilters(EMPTY_JOB_SEARCH_FILTERS);
                        },
                      }
                    : { label: "Check again", onClick: recs.reload }
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

        {tab === "saved" && (
          <div className="space-y-3">
            {savedError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {savedError}
              </div>
            )}
            {savedLoading ? (
              <div className="space-y-4" aria-busy="true">
                <LoadingNote label="Loading your saved roles…" />
                <div className="space-y-3">
                  {[0, 1].map((i) => (
                    <JobCardSkeleton key={i} />
                  ))}
                </div>
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
