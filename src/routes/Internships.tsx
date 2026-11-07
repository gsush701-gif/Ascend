import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { PublicShell } from "../components/layout/PublicShell";
import { JobFilters } from "../components/jobs/JobFilters";
import { JobsHero } from "../components/jobs/JobsHero";
import { JobCard, JobCardSkeleton } from "../components/jobs/JobCard";
import { ProviderNotConfiguredBanner } from "../components/jobs/ProviderNotConfiguredBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useJobSearch } from "../features/jobs/hooks/useJobSearch";
import { useFeedPreview } from "../features/jobs/hooks/useFeedPreview";
import { getVisitorId, logEvent } from "../lib/analytics";
import { buttonPrimary, buttonSecondary } from "../lib/ui";
import { EMPTY_JOB_SEARCH_FILTERS, type JobSearchFilters } from "../types/jobs";

const SIGNUP_FOR_MATCHES = "/signup?next=%2Fjobs";
const DESCRIPTION =
  "Browse open internships and new-grad roles from companies' own career pages, refreshed daily. Sign in free to see every role, ranked against your resume.";

/** How many roles a visitor without an account sees before the sign-up card. */
const PREVIEW_SIZE = 6;
/** How many a signed-in student gets per page. */
const MEMBER_PAGE_SIZE = 20;

const fmt = (n: number) => n.toLocaleString();

/**
 * The public front door to the job feed. A visitor sees the newest few roles for
 * real, then a card inviting them to create a free account to see the rest,
 * ranked against their resume. Searching and filtering work, but each search
 * shows only a handful. A signed-in student gets the full list. Every role links
 * to the company's own posting, where the student applies.
 */
export function Internships() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMember = Boolean(user);
  const search = useJobSearch(isMember ? MEMBER_PAGE_SIZE : PREVIEW_SIZE);
  const { preview } = useFeedPreview();
  const [filters, setFilters] = useState<JobSearchFilters>(EMPTY_JOB_SEARCH_FILTERS);
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

  // Show the newest roles straight away. Waits until we know whether the visitor is
  // signed in (it decides how many to ask for), and asks again if that changes.
  useEffect(() => {
    if (authLoading) return;
    Promise.resolve().then(() => runSearch(EMPTY_JOB_SEARCH_FILTERS, 1));
  }, [authLoading, runSearch]);

  function ctaClicked(where: string) {
    logEvent("internships_cta_clicked", { vid: getVisitorId(), where });
  }

  /** Saving needs an account, so a visitor is taken to sign up; a signed-in student goes to their matches. */
  function onSave() {
    ctaClicked("save");
    navigate(isMember ? "/jobs" : SIGNUP_FOR_MATCHES);
  }

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_JOB_SEARCH_FILTERS);
  const remaining = Math.max(0, search.totalCount - search.jobs.length);
  const showGate = !isMember && search.providerConfigured !== false && remaining > 0;
  const showingResults = search.hasSearched && search.providerConfigured !== false && search.jobs.length > 0;

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl space-y-6 pt-4">
        <JobsHero
          count={preview?.count}
          title="Internships and new-grad roles, straight from company career pages"
          subtitle="Updated daily from over 100 companies, so the roles come from the source and closed ones drop off. You apply on the company's own site."
        />

        <section
          className="flex flex-col gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          aria-label="Rank these roles for your resume"
        >
          <div>
            <div className="font-semibold text-slate-900">
              {isMember ? "Which of these fit you best?" : "Want these ranked by how well you fit?"}
            </div>
            <p className="mt-0.5 text-sm text-slate-600">
              Upload your resume to see a match for every role, the skills you already have and the ones each posting
              also asks for.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            {isMember ? (
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

        {authLoading || !search.hasSearched || (search.loading && search.jobs.length === 0) ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: isMember ? 4 : 3 }, (_, i) => (
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
              {isMember
                ? `${fmt(search.totalCount)} ${search.totalCount === 1 ? "role" : "roles"}, newest first`
                : `Showing the newest ${fmt(search.jobs.length)} of ${fmt(search.totalCount)} ${
                    search.totalCount === 1 ? "role" : "roles"
                  }${filtersActive ? " that match" : ""}`}
            </div>
            <div className="space-y-3">
              {search.jobs.map((job) => (
                <JobCard key={job.id} job={job} onSave={onSave} />
              ))}
            </div>

            {showGate && (
              <section
                className="rounded-xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/[0.07] to-white p-6 text-center shadow-sm sm:p-8"
                aria-label="Sign up to see every role"
              >
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-700">
                  <Lock className="h-5 w-5" aria-hidden />
                </div>
                <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-slate-900">
                  {fmt(remaining)} more {remaining === 1 ? "role" : "roles"}{" "}
                  {filtersActive ? "match your search" : "are open right now"}
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
                  Create a free account to see every one, ranked by how well your resume fits, with the skills you have
                  and the ones each posting asks for. It takes about 10 seconds with Google.
                </p>
                <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
                  <Link to={SIGNUP_FOR_MATCHES} className={buttonPrimary} onClick={() => ctaClicked("gate")}>
                    See all {fmt(search.totalCount)} roles, free
                  </Link>
                  <Link to="/try?example=1" className={buttonSecondary} onClick={() => ctaClicked("gate-try")}>
                    Try a fit score first
                  </Link>
                </div>
                <p className="mt-3 text-xs text-slate-500">No card needed. Free during beta.</p>
              </section>
            )}

            {isMember && search.hasMore && (
              <div className="flex justify-center pt-1">
                <Button variant="secondary" onClick={() => void search.loadMore()} disabled={search.loadingMore}>
                  {search.loadingMore ? "Loading…" : `Show more (${fmt(remaining)} left)`}
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
