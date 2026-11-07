import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { QuickAddModal } from "../components/QuickAddModal";
import { OnboardingModal } from "../components/onboarding/OnboardingModal";
import { useTracker } from "../features/tracker/hooks/useTracker";
import {
  getRecentCompanies,
  getRecentRoles,
  getFunnelCounts,
  getApplicationsSentCount,
  getResponseRate,
  getRejectionRate,
  getAverageAlignment,
  getUpcomingDeadlines,
  getInterviewCount,
  getFitScoreInsight,
  getPerformanceSentence,
  getApplicationsThisWeek,
  getApplicationsLastWeek,
  getAlignmentTrend,
  getAlignmentHistoryFromTracker,
  getReadinessScores,
  getRecentActivity,
  formatRelativeDate,
  type UpcomingDeadline,
  type FunnelCounts,
  type ReadinessScores,
  type ActivityItem,
} from "../lib/dashboardStats";
import { TRACKER_STATUS_ORDER } from "../types/tracker";
import { alignmentToPreparedness } from "../lib/preparedness";
import { useProfile } from "../lib/profile";
import { KpiCard } from "../components/dashboard/KpiCard";
import { AlignmentChart } from "../components/ui/AlignmentChart";
import { AnimatedBar } from "../components/ui/AnimatedBar";
import { EmptyState } from "../components/ui/EmptyState";
import { OnboardingChecklist } from "../components/onboarding/OnboardingChecklist";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import { toast } from "../components/ui/toast";
import { isResumeLabUsed } from "../lib/onboarding";
import {
  card,
  buttonPrimary,
  buttonGhost,
  pageHeader,
  pageHeaderActions,
  pageTitle,
  pageSubtitle,
} from "../lib/ui";
import { ThisWeekCard } from "../features/advisor/ThisWeekCard";
import { trackAdvisorJob } from "../features/advisor/trackJob";

export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const { tracker: items, addManualTrackerItem, updateRoleFields } = useTracker(undefined);
  const { profile, loading: profileLoading } = useProfile();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const handleQuickAdd = useCallback(
    (company: string, role: string) => {
      addManualTrackerItem(
        () => {},
        undefined,
        { company, role, status: "Applied", nextStep: "Applied" }
      );
      setQuickAddOpen(false);
      toast.success({
        title: "Role added",
        description: `${role} at ${company}`,
      });
    },
    [addManualTrackerItem]
  );

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  // Ask about major / target role only after the person has a role tracked, so
  // a new account's first screen shows the product, not a form. (They can still
  // skip it, and skipping stores a value so it never comes back.)
  const showOnboarding =
    !onboardingDismissed && !loading && !profileLoading && !!profile && !profile.major && items.length > 0;

  const totalApplications = getApplicationsSentCount(items);
  const interviewRate = getResponseRate(items);
  const funnel = getFunnelCounts(items);
  const avgAlignment = getAverageAlignment(items);
  // const { low: expectedLow, high: expectedHigh } = getExpectedInterviewsRange(
  //   totalApplications,
  //   interviewRate
  // );

  const hasStatusUpdate = items.some((i) => i.status !== "Applied");
  const recentActivity = getRecentActivity(items);

  return (
    <AppShell>
      <QuickAddModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onAdd={handleQuickAdd}
        recentCompanies={getRecentCompanies(items)}
        recentRoles={getRecentRoles(items)}
        existingItems={items}
      />
      {showOnboarding && (
        <OnboardingModal onComplete={() => setOnboardingDismissed(true)} />
      )}

      <div className="space-y-8">
        {loading ? (
          <DashboardSkeleton />
        ) : totalApplications === 0 ? (
          <div className="animate-fade-in space-y-8">
            <header className={pageHeader}>
              <div>
                <h1 className={pageTitle}>Dashboard</h1>
                <p className={pageSubtitle}>Performance, actions, and outlook in one place.</p>
              </div>
              <div className={pageHeaderActions}>
                <button type="button" onClick={() => setQuickAddOpen(true)} className={buttonGhost}>
                  Quick add
                </button>
                <button type="button" onClick={() => navigate("/analyzer")} className={buttonPrimary}>
                  <Plus className="h-4 w-4" />
                  Add role
                </button>
              </div>
            </header>

            <ThisWeekCard onTrackJob={(job) => trackAdvisorJob({ addManualTrackerItem, updateRoleFields }, job)} />

            <OnboardingChecklist
              rolesCount={items.length}
              hasStatusUpdate={hasStatusUpdate}
              resumeLabUsed={isResumeLabUsed()}
            />

            <EmptyState
              title="Start with a job you're thinking about"
              subtitle="Paste a posting and upload your resume to see your fit score and the skills to fix. Roles you add are tracked here."
              primaryAction={{
                label: "Analyze a job against my resume",
                onClick: () => navigate("/analyzer"),
              }}
              secondaryAction={{
                label: "See it on an example",
                onClick: () => navigate("/analyzer?example=1"),
              }}
              tertiaryAction={{
                label: "Add a role manually",
                onClick: () => setQuickAddOpen(true),
              }}
            />
          </div>
        ) : (
          <div className="animate-fade-in space-y-8">
        <header className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Dashboard</h1>
            <p className={pageSubtitle}>
              {getPerformanceSentence(
                items,
                interviewRate,
                getApplicationsThisWeek(items),
                getApplicationsLastWeek(items)
              ) ?? "Performance, actions, and outlook in one place."}
            </p>
          </div>
          <div className={pageHeaderActions}>
            <button type="button" onClick={() => setQuickAddOpen(true)} className={buttonGhost}>
              Quick add
            </button>
            <button type="button" onClick={() => navigate("/analyzer")} className={buttonPrimary}>
              <Plus className="h-4 w-4" />
              Add role
            </button>
          </div>
        </header>

        <ThisWeekCard onTrackJob={(job) => trackAdvisorJob({ addManualTrackerItem, updateRoleFields }, job)} />

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-7">
            <section className={`${card} overflow-hidden !p-0`} aria-label="Summary">
              <div className="grid divide-y divide-slate-100 md:grid-cols-4 md:divide-x md:divide-y-0">
                <FitScoreHero
                  avgAlignment={avgAlignment}
                  insight={getFitScoreInsight(items)}
                  trend={getAlignmentTrend(items)}
                />
                <KpiCard
                  label="Apps sent"
                  value={totalApplications}
                  badge={
                    getApplicationsThisWeek(items) > 0
                      ? `+${getApplicationsThisWeek(items)} this wk`
                      : undefined
                  }
                />
                <KpiCard
                  label="Interview rate"
                  value={interviewRate != null ? `${interviewRate}%` : "—"}
                  badge={
                    interviewRate != null && interviewRate >= 30
                      ? "Above avg"
                      : interviewRate != null
                        ? "Below 30%"
                        : undefined
                  }
                  hint={
                    interviewRate != null && interviewRate < 30
                      ? "Improve fit score to increase interview probability."
                      : undefined
                  }
                />
                <KpiCard label="Interviews" value={getInterviewCount(items)} />
              </div>
            </section>

            <OnboardingChecklist
              rolesCount={items.length}
              hasStatusUpdate={hasStatusUpdate}
              resumeLabUsed={isResumeLabUsed()}
            />

            <section className={card}>
              <h2 className="text-sm font-semibold text-slate-900">
                Fit score trend
              </h2>
              <AlignmentChart
                points={getAlignmentHistoryFromTracker(items)}
                className="mt-4"
              />
            </section>

            <section className={card}>
              <h2 className="text-sm font-semibold text-slate-900">
                Upcoming deadlines
              </h2>
              <UpcomingDeadlinesList
                deadlines={getUpcomingDeadlines(items)}
                onRoleClick={(id) => navigate(`/roles/${id}`)}
              />
            </section>
          </div>

          <div className="space-y-8 lg:col-span-5">
            <section className={card}>
              <h2 className="text-sm font-semibold text-slate-900">By status</h2>
              <ByStatusBars
                counts={funnel}
                total={items.length}
                appliedCount={totalApplications}
                interviewRate={interviewRate}
                rejectionRate={getRejectionRate(items)}
                thisWeek={getApplicationsThisWeek(items)}
                lastWeek={getApplicationsLastWeek(items)}
              />
            </section>

            <section className={card}>
              <h2 className="text-sm font-semibold text-slate-900">
                Resume readiness
              </h2>
              <ReadinessBars scores={getReadinessScores(items)} />
            </section>

            <section className={card}>
              <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
              <RecentActivityList
                activity={recentActivity}
                onRoleClick={(id) => navigate(`/roles/${id}`)}
              />
            </section>
          </div>
        </div>

        </div>
        )}
      </div>
    </AppShell>
  );
}

function FitScoreHero({
  avgAlignment,
  insight,
  trend,
}: {
  avgAlignment: number | null;
  insight: string | null;
  trend: "up" | "down" | "stable" | null;
}) {
  const pct = avgAlignment ?? 0;
  const level =
    avgAlignment != null ? alignmentToPreparedness(avgAlignment) : null;
  const qualifier =
    level === "High"
      ? "Strong"
      : level === "Medium"
        ? "On track"
        : level === "Low"
          ? "Needs improvement"
          : null;

  return (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <div className="text-sm text-slate-500">Fit score</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span className="font-display text-3xl font-semibold tracking-tight text-slate-900">
          {avgAlignment != null ? `${avgAlignment}%` : "—"}
        </span>
        {qualifier != null && <span className="text-xs font-medium text-slate-500">{qualifier}</span>}
        {trend != null && trend !== "stable" && (
          <span
            className={`text-xs font-medium ${trend === "up" ? "text-emerald-600" : "text-rose-600"}`}
          >
            {trend === "up" ? "↑ Trending up" : "↓ Trending down"}
          </span>
        )}
      </div>
      <div className="mt-3">
        <AnimatedBar pct={pct} gradient="linear-gradient(90deg, #22d3ee, #a78bfa)" />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        {insight ?? "Based on resume vs job requirements"}
      </p>
    </div>
  );
}

function UpcomingDeadlinesList({
  deadlines,
  onRoleClick,
}: {
  deadlines: UpcomingDeadline[];
  onRoleClick: (id: string) => void;
}) {
  if (deadlines.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500 italic">
        No upcoming deadlines. Set deadlines on your roles to stay on track.
      </p>
    );
  }
  return (
    <div className="-mx-2 mt-3 divide-y divide-slate-100">
      {deadlines.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onRoleClick(d.id)}
          className="flex w-full items-center justify-between rounded-lg px-2 py-3 text-left text-sm transition hover:bg-slate-50"
        >
          <span className="flex items-center gap-2">
            {d.isOverdue && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
            )}
            <span className="text-slate-900">
              {d.role} at {d.company}
            </span>
          </span>
          {d.isOverdue ? (
            <span className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
              Overdue
            </span>
          ) : (
            <span className="text-slate-500">{d.daysText}</span>
          )}
        </button>
      ))}
    </div>
  );
}

const STATUS_ORDER: (keyof FunnelCounts)[] = TRACKER_STATUS_ORDER;

const STATUS_BAR_COLORS: Record<keyof FunnelCounts, string> = {
  Wishlist: "bg-slate-400",
  Analyzed: "bg-indigo-400",
  "Ready to Apply": "bg-cyan-300",
  Applied: "bg-cyan-500",
  "Recruiter Contact": "bg-violet-300",
  Interview: "bg-violet-500",
  "Technical Interview": "bg-violet-600",
  "Final Interview": "bg-violet-700",
  Offer: "bg-emerald-500",
  Accepted: "bg-emerald-600",
  Rejected: "bg-rose-500/70",
  Withdrawn: "bg-slate-500",
};

function ByStatusBars({
  counts,
  total,
  appliedCount,
  interviewRate,
  rejectionRate,
  thisWeek,
  lastWeek,
}: {
  counts: FunnelCounts;
  total: number;
  appliedCount: number;
  interviewRate: number | null;
  rejectionRate: number | null;
  thisWeek: number;
  lastWeek: number;
}) {
  if (total === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500 italic">
        No applications yet. Add roles to see status breakdown.
      </p>
    );
  }
  const rows = STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0).map((status) => ({
    status,
    count: counts[status] ?? 0,
    pct: ((counts[status] ?? 0) / total) * 100,
  }));
  const trendText =
    lastWeek > 0
      ? thisWeek > lastWeek
        ? `↑ ${thisWeek} vs ${lastWeek} last week`
        : thisWeek < lastWeek
          ? `↓ ${thisWeek} vs ${lastWeek} last week`
          : null
      : null;
  const interviewRateContext =
    interviewRate != null && appliedCount >= 3
      ? interviewRate >= 30
        ? `Interview rate: ${interviewRate}% (above avg)`
        : `Interview rate: ${interviewRate}% (below 30% avg)`
      : null;
  const rejectionRateContext =
    rejectionRate != null && appliedCount >= 3
      ? `Rejection rate: ${rejectionRate}%`
      : null;

  return (
    <div className="mt-4 space-y-2">
      {rows.map(({ status, count, pct }, i) => (
        <div key={status}>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{status}</span>
            <span>{count} ({Math.round(pct)}%)</span>
          </div>
          <div className="mt-1.5">
            <AnimatedBar pct={pct} colorClassName={STATUS_BAR_COLORS[status]} delayMs={i * 80} />
          </div>
        </div>
      ))}
      <div className="mt-3 space-y-0.5 border-t border-slate-200 pt-3 text-xs text-slate-500">
        {interviewRateContext && <div>{interviewRateContext}</div>}
        {rejectionRateContext && <div>{rejectionRateContext}</div>}
        {trendText && <div>Apps: {trendText}</div>}
      </div>
    </div>
  );
}

/**
 * Single real, data-backed readiness bar. This used to also show "Projects", "Deployments",
 * and "Interview prep" bars fixed at 45% / 15% / 25% for every user — flat placeholders with no
 * signal behind them. Cut in favor of the one score that actually traces to saved analysis data.
 */
function ReadinessBars({ scores }: { scores: ReadinessScores }) {
  if (scores.resume == null) {
    return (
      <p className="mt-4 text-sm text-slate-500 italic">
        Analyze a resume against a role to see your resume readiness here.
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Resume strength</span>
          <span>{scores.resume}%</span>
        </div>
        <div className="mt-1.5">
          <AnimatedBar pct={scores.resume} colorClassName="bg-cyan-500" />
        </div>
      </div>
    </div>
  );
}

/** Recently touched roles (added or updated), newest first — a real activity trail built from
 * tracker timestamps, not a fabricated feed. */
function RecentActivityList({
  activity,
  onRoleClick,
}: {
  activity: ActivityItem[];
  onRoleClick: (id: string) => void;
}) {
  if (activity.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500 italic">
        No activity yet. Add or update a role to see it here.
      </p>
    );
  }
  return (
    <div className="-mx-2 mt-3 divide-y divide-slate-100">
      {activity.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onRoleClick(a.id)}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left text-sm transition hover:bg-slate-50"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_BAR_COLORS[a.status]}`}
            />
            <span className="min-w-0 truncate text-slate-900">
              {a.role} <span className="text-slate-400">at</span> {a.company}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
            {a.hasCoverLetter && (
              <span className="rounded-full border border-slate-200 bg-slate-900/5 px-1.5 py-0.5 text-[10px] text-slate-500">
                Cover letter
              </span>
            )}
            <span>{formatRelativeDate(a.date)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
