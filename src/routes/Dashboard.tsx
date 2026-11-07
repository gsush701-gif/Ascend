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
  getApplicationsByWeek,
  getAlignmentTrend,
  getAlignmentHistoryFromTracker,
  getReadinessScores,
  getRecentActivity,
  formatRelativeDate,
  type UpcomingDeadline,
  type FunnelCounts,
  type ActivityItem,
} from "../lib/dashboardStats";
import { TRACKER_STATUS_ORDER } from "../types/tracker";
import { alignmentToPreparedness } from "../lib/preparedness";
import { useProfile } from "../lib/profile";
import { KpiCard } from "../components/dashboard/KpiCard";
import { AlignmentChart } from "../components/ui/AlignmentChart";
import { AnimatedBar } from "../components/ui/AnimatedBar";
import { Sparkline } from "../components/ui/Sparkline";
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

  const interviews = getInterviewCount(items);
  const thisWeek = getApplicationsThisWeek(items);
  const lastWeek = getApplicationsLastWeek(items);
  const weeklyApps = getApplicationsByWeek(items, 8).map((w) => w.applications);
  const fitSpark = getAlignmentHistoryFromTracker(items, 12).map((p) => p.alignment);
  const fitTrend = getAlignmentTrend(items);
  const readiness = getReadinessScores(items);

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
          <div className="animate-fade-in space-y-6">
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

        <section className={`${card} overflow-hidden !p-0`} aria-label="Summary">
          <div className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4">
            <KpiCard
              label="Fit score"
              value={avgAlignment != null ? `${avgAlignment}%` : "—"}
              badge={fitQualifier(avgAlignment) ?? undefined}
              visual={
                fitSpark.length >= 2 ? (
                  <Sparkline values={fitSpark} className="w-full" />
                ) : (
                  <AnimatedBar pct={avgAlignment ?? 0} gradient="linear-gradient(90deg, #22d3ee, #a78bfa)" />
                )
              }
              hint={fitTrend === "up" ? "Trending up" : fitTrend === "down" ? "Trending down" : undefined}
            />
            <KpiCard
              label="Applications sent"
              value={totalApplications}
              badge={thisWeek > 0 ? `+${thisWeek} this week` : undefined}
              visual={<Sparkline values={weeklyApps} className="w-full" color="#8b5cf6" />}
              hint={lastWeek > 0 || thisWeek > 0 ? `${thisWeek} this week, ${lastWeek} last week` : undefined}
            />
            <KpiCard
              label="Interview rate"
              value={interviewRate != null ? `${interviewRate}%` : "—"}
              badge={
                interviewRate != null && totalApplications >= 3
                  ? interviewRate >= 30
                    ? "Above avg"
                    : "Below 30% avg"
                  : undefined
              }
              visual={<AnimatedBar pct={interviewRate ?? 0} colorClassName="bg-violet-500" />}
              hint={`${interviews} interview${interviews === 1 ? "" : "s"} from ${totalApplications} application${totalApplications === 1 ? "" : "s"}`}
            />
            <KpiCard
              label="Resume strength"
              value={readiness.resume != null ? `${readiness.resume}%` : "—"}
              visual={<AnimatedBar pct={readiness.resume ?? 0} colorClassName="bg-cyan-500" />}
              hint={readiness.resume == null ? "Analyze a resume against a role to see this." : undefined}
            />
          </div>
        </section>

        <OnboardingChecklist
          rolesCount={items.length}
          hasStatusUpdate={hasStatusUpdate}
          resumeLabUsed={isResumeLabUsed()}
        />

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-8">
            <section className={card}>
              <h2 className="text-sm font-semibold text-slate-900">Fit score trend</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {getFitScoreInsight(items) ?? "Your average fit score by day, from the roles you analyze."}
              </p>
              <AlignmentChart points={getAlignmentHistoryFromTracker(items)} className="mt-4" />
            </section>

            <section className={card}>
              <h2 className="text-sm font-semibold text-slate-900">Upcoming deadlines</h2>
              <UpcomingDeadlinesList
                deadlines={getUpcomingDeadlines(items)}
                onRoleClick={(id) => navigate(`/roles/${id}`)}
              />
            </section>
          </div>

          <div className="min-w-0 space-y-6 lg:col-span-4">
            <section className={card}>
              <h2 className="text-sm font-semibold text-slate-900">Pipeline</h2>
              <PipelineCard
                counts={funnel}
                total={items.length}
                appliedCount={totalApplications}
                interviewRate={interviewRate}
                rejectionRate={getRejectionRate(items)}
              />
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

function fitQualifier(avgAlignment: number | null): string | null {
  if (avgAlignment == null) return null;
  const level = alignmentToPreparedness(avgAlignment);
  return level === "High" ? "Strong" : level === "Medium" ? "On track" : "Needs work";
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

function PipelineCard({
  counts,
  total,
  appliedCount,
  interviewRate,
  rejectionRate,
}: {
  counts: FunnelCounts;
  total: number;
  appliedCount: number;
  interviewRate: number | null;
  rejectionRate: number | null;
}) {
  if (total === 0) {
    return (
      <p className="mt-4 text-sm italic text-slate-500">
        No applications yet. Add roles to see your pipeline.
      </p>
    );
  }
  const rows = STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0).map((status) => ({
    status,
    count: counts[status] ?? 0,
  }));
  const notes = [
    interviewRate != null && appliedCount >= 3 ? `Interview rate ${interviewRate}%` : null,
    rejectionRate != null && appliedCount >= 3 ? `Rejection rate ${rejectionRate}%` : null,
  ].filter((n): n is string => n != null);

  return (
    <div className="mt-4">
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Roles by status">
        {rows.map(({ status, count }) => (
          <span
            key={status}
            className={`h-full ${STATUS_BAR_COLORS[status]}`}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${status}: ${count}`}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
        {rows.map(({ status, count }) => (
          <li key={status} className="flex items-center justify-between text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_BAR_COLORS[status]}`} />
              <span className="truncate">{status}</span>
            </span>
            <span className="font-medium tabular-nums text-slate-900">{count}</span>
          </li>
        ))}
      </ul>
      {notes.length > 0 && (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">{notes.join("  ·  ")}</p>
      )}
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
