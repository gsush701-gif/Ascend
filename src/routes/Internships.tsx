import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";
import { JobFilters } from "../components/jobs/JobFilters";
import { JobCard, JobCardSkeleton } from "../components/jobs/JobCard";
import { ProviderNotConfiguredBanner } from "../components/jobs/ProviderNotConfiguredBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useJobSearch } from "../features/jobs/hooks/useJobSearch";
import { useFeedPreview } from "../features/jobs/hooks/useFeedPreview";
import { getVisitorId, logEvent } from "../lib/analytics";
import { buttonPrimary, buttonSecondary } from "../lib/ui";
import { cn } from "../lib/cn";
import { EMPTY_JOB_SEARCH_FILTERS, type JobSearchFilters } from "../types/jobs";

const SIGNUP_FOR_MATCHES = "/signup?next=%2Fjobs";
const DESCRIPTION =
  "Browse open internships and new-grad roles from companies' own career pages, refreshed daily. Free to browse; sign in to rank them against your resume.";

const fmt = (n: number) => n.toLocaleString();

/**
 * The public front door to the job feed: anyone can browse real internships and
 * new-grad roles, with no account. Signing in unlocks what needs a resume: the
 * match percentage, saving a role and tracking it. Every role links to the
 * company's own posting, where the student applies.
 */
export function Internships() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = useJobSearch();
  const { preview } = useFeedPreview();
  const [filters, setFilters] = useState<JobSearchFilters>(EMPTY_JOB_SEARCH_FILTERS);
  const started = useRef(false);
  const { runSearch } = search;

  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") ?? null;
    document.title = "Open internships and new-grad roles | Ascend";
    meta?.setAttribute("content", DESCRIPTION);
    logEvent("internships_viewed", { vid: getVisitorId() });
    return () => {
      document.title = previousTitle;
      if (previousDescription !== null) meta?.setAttribute("content", previousDescription);
    };
  }, []);

  // Show the newest roles straight away instead of an empty page.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    Promise.resolve().then(() => runSearch(EMPTY_JOB_SEARCH_FILTERS, 1));
  }, [runSearch]);

  function ctaClicked(where: string) {
    logEvent("internships_cta_clicked", { vid: getVisitorId(), where });
  }

  /** Saving needs an account, so a visitor is taken to sign up; a signed-in student goes to their matches. */
  function onSave() {
    ctaClicked("save");
    navigate(user ? "/jobs" : SIGNUP_FOR_MATCHES);
  }

  const showingResults = search.hasSearched && search.providerConfigured !== false && search.jobs.length > 0;

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl space-y-6 pt-4">
        <header className="space-y-3 text-center sm:text-left">
          {preview && (
            <div className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              {fmt(preview.count)} open roles right now
            </div>
          )}
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Internships and new-grad roles, straight from company career pages
          </h1>
          <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
            Updated daily from over 100 companies, so the roles come from the source and closed ones drop off. Free to
            browse, and you apply on the company's own site.
          </p>
        </header>

        <section
          className="flex flex-col gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          aria-label="Rank these roles for your resume"
        >
          <div>
            <div className="font-semibold text-slate-900">
              {user ? "Which of these fit you best?" : "Want these ranked by how well you fit?"}
            </div>
            <p className="mt-0.5 text-sm text-slate-600">
              Upload your resume to see a match for every role, the skills you already have and the ones each posting
              also asks for.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            {user ? (
              <Link to="/jobs" className={buttonPrimary} onClick={() => ctaClicked("banner")}>
                Open my matches
              </Link>
            ) : (
              <>
                <Link to={SIGNUP_FOR_MATCHES} className={buttonPrimary} onClick={() => ctaClicked("banner")}>
                  Rank them for my resume, free
                </Link>
                <Link to="/try?example=1" className={buttonSecondary} onClick={() => ctaClicked("try")}>
                  Try a fit score first
                </Link>
              </>
            )}
          </div>
        </section>

        <div className="rounded-xl border border-slate-200 bg-dash-card p-4 shadow-sm">
          <JobFilters
            filters={filters}
            onChange={setFilters}
            onSearch={(next) => runSearch(next ?? filters, 1)}
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
            {[0, 1, 2, 3].map((i) => (
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
                void runSearch(EMPTY_JOB_SEARCH_FILTERS, 1);
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
              {search.jobs.map((job, index) => (
                <div key={job.id} className="space-y-3">
                  <JobCard job={job} onSave={onSave} />
                  {index === 4 && !user && (
                    <div className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm text-slate-700">
                        Seeing a role you like? Save it and see how well your resume fits it.
                      </span>
                      <Link
                        to={SIGNUP_FOR_MATCHES}
                        className={cn(buttonPrimary, "h-8 px-3 text-xs")}
                        onClick={() => ctaClicked("inline")}
                      >
                        Sign in free
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {search.hasMore && (
              <div className="flex justify-center pt-1">
                <Button variant="secondary" onClick={() => void search.loadMore()} disabled={search.loadingMore}>
                  {search.loadingMore ? "Loading…" : `Show more (${fmt(search.totalCount - search.jobs.length)} left)`}
                </Button>
              </div>
            )}
          </>
        )}

        {showingResults && (
          <p className="pb-4 text-center text-xs text-slate-400">
            Roles are copied from each company's own career page and link back to it. Ascend does not apply for you.
          </p>
        )}
      </div>
    </PublicShell>
  );
}
