import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Send, TrendingUp, CalendarCheck } from "lucide-react";
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
  getExpectedInterviewsRange,
  getUpcomingDeadlines,
  getInterviewCount,
  getTopInsight,
  getFitScoreInsight,
  getPerformanceSentence,
  getApplicationsByWeek,
  getApplicationsThisWeek,
  getApplicationsLastWeek,
  getAlignmentHistoryFromTracker,
  getReadinessScores,
  type UpcomingDeadline,
  type FunnelCounts,
  type ReadinessScores,
} from "../lib/dashboardStats";
import { alignmentToPreparedness } from "../lib/preparedness";
import { useProfile } from "../lib/profile";
import { KpiCard } from "../components/dashboard/KpiCard";
import { OutlookCard } from "../components/dashboard/OutlookCard";
import { AlignmentChart } from "../components/ui/AlignmentChart";
import { AnimatedBar } from "../components/ui/AnimatedBar";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { OnboardingChecklist } from "../components/onboarding/OnboardingChecklist";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import { toast } from "../components/ui/toast";
import { isResumeLabUsed } from "../lib/onboarding";

const BENCHMARK_RATE = 65;

export function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { tracker: items, addManualTrackerItem } = useTracker(undefined);
  const { profile, loading: profileLoading } = useProfile();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [whyTrackingOpen, setWhyTrackingOpen] = useState(false);

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

  useEffect(() => {
    if (!loading && !profileLoading && profile && !profile.major) {
      setShowOnboarding(true);
    }
  }, [loading, profileLoading, profile]);

  const totalApplications = getApplicationsSentCount(items);
  const interviewRate = getResponseRate(items);
  const funnel = getFunnelCounts(items);
  const avgAlignment = getAverageAlignment(items);
  const { low: expectedLow, high: expectedHigh } = getExpectedInterviewsRange(
    totalApplications,
    interviewRate
  );
  const gapTo70 =
    avgAlignment != null ? Math.max(0, 70 - avgAlignment) : null;

  const hasStatusUpdate = items.some((i) => i.status !== "Applied");

  return (
    <AppShell>
      <QuickAddModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onAdd={handleQuickAdd}
        recentCompanies={getRecentCompanies(items)}
        recentRoles={getRecentRoles(items)}
      />
      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}

      <Modal
        isOpen={whyTrackingOpen}
        onClose={() => setWhyTrackingOpen(false)}
        title="Why tracking matters"
      >
        <ul className="space-y-2">
          <li>• See which applications get responses</li>
          <li>• Spot patterns (company size, role type)</li>
          <li>• Stay on top of follow-ups</li>
        </ul>
      </Modal>

      <div className="space-y-6">
        {loading ? (
          <DashboardSkeleton />
        ) : totalApplications === 0 ? (
          <div className="animate-fade-in space-y-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  Performance, actions, and outlook in one place.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(true)}
                  className="btn-press rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-900/[0.04]"
                >
                  Quick add
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/analyzer")}
                  className="btn-press inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-cyan-400"
                >
                  <Plus className="h-4 w-4" />
                  Add role
                </button>
              </div>
            </header>

            <OnboardingChecklist
              rolesCount={items.length}
              hasStatusUpdate={hasStatusUpdate}
              resumeLabUsed={isResumeLabUsed()}
            />

            <EmptyState
              title="No applications yet"
              subtitle="Add a few roles to unlock performance insights."
              primaryAction={{
                label: "Add role",
                onClick: () => setQuickAddOpen(true),
              }}
              secondaryAction={{
                label: "Why tracking matters",
                onClick: () => setWhyTrackingOpen(true),
              }}
            />
          </div>
        ) : (
          <div className="animate-fade-in space-y-6">
        {/* SaaS header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {getPerformanceSentence(
                items,
                interviewRate,
                getApplicationsThisWeek(items),
                getApplicationsLastWeek(items)
              ) ?? "Performance, actions, and outlook in one place."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="btn-press rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-900/[0.04]"
            >
              Quick add
            </button>
            <button
              type="button"
              onClick={() => navigate("/analyzer")}
              className="btn-press inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-cyan-400"
            >
              <Plus className="h-4 w-4" />
              Add role
            </button>
          </div>
        </header>

        <OnboardingChecklist
          rolesCount={items.length}
          hasStatusUpdate={hasStatusUpdate}
          resumeLabUsed={isResumeLabUsed()}
        />

        {/* Top insight banner */}
        {(() => {
          const insight = getTopInsight(
            items,
            interviewRate,
            avgAlignment,
            gapTo70
          );
          if (!insight) return null;
          const isOverdue = insight.includes("overdue");
          const content = (
            <>
              {insight}
              {isOverdue && " — Review now →"}
            </>
          );
          return isOverdue ? (
            <button
              type="button"
              onClick={() => navigate("/roles")}
              className="w-full rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-left text-sm text-cyan-700/90 transition hover:bg-cyan-500/10"
            >
              {content}
            </button>
          ) : (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-700/90">
              {content}
            </div>
          );
        })()}

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-dash-card p-6">
              <div
                className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-cyan-500/10 blur-[70px]"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-violet-500/10 blur-[70px]"
                aria-hidden
              />
              <div className="relative text-xs uppercase tracking-wide text-slate-500">
                Fit score
              </div>
              <FitScoreHero
                avgAlignment={avgAlignment}
                insight={getFitScoreInsight(items)}
              />
            </section>

            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard label="Apps sent" value={totalApplications} icon={Send} accent="cyan" />
              <KpiCard
                label="Interview rate"
                value={
                  interviewRate != null ? `${interviewRate}%` : "—"
                }
                icon={TrendingUp}
                accent="violet"
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
              <KpiCard label="Interviews" value={getInterviewCount(items)} icon={CalendarCheck} accent="emerald" />
            </div>

            <section className="rounded-xl border border-slate-200 bg-dash-card p-6">
              <h2 className="text-sm font-semibold text-slate-900">
                Fit score trend
              </h2>
              <AlignmentChart
                points={getAlignmentHistoryFromTracker(items)}
                className="mt-4"
              />
            </section>

            <section className="rounded-xl border border-slate-200 bg-dash-card p-6">
              <h2 className="text-sm font-semibold text-slate-900">
                Upcoming deadlines
              </h2>
              <UpcomingDeadlinesList
                deadlines={getUpcomingDeadlines(items)}
                onRoleClick={(id) => navigate(`/roles/${id}`)}
              />
            </section>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <section className="rounded-xl border border-slate-200 bg-dash-card p-6">
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

            <section className="rounded-xl border border-slate-200 bg-dash-card p-6">
              <h2 className="text-sm font-semibold text-slate-900">
                Readiness breakdown
              </h2>
              <ReadinessBars scores={getReadinessScores(items)} />
            </section>

            <section className="rounded-xl border border-slate-200 bg-dash-card p-6">
              <h2 className="text-sm font-semibold text-slate-900">
                Next actions
              </h2>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => navigate("/analyzer")}
                  className="btn-press w-full rounded-xl border border-slate-200 bg-dash-surface p-4 text-left transition hover:bg-dash-surface/90"
                >
                  <div className="text-sm font-semibold text-slate-900">Analyze resume</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Get fit score and skill gaps for a role
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/roles")}
                  className="btn-press w-full rounded-xl border border-slate-200 bg-dash-surface p-4 text-left transition hover:bg-dash-surface/90"
                >
                  <div className="text-sm font-semibold text-slate-900">Add role</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Track status and deadlines
                  </div>
                </button>
              </div>
            </section>
          </div>
        </div>

        {totalApplications > 0 && (
          <>
            <section className="rounded-xl border border-slate-200 bg-dash-card p-5">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                Performance insight
              </div>
              <PerformanceInsight
                interviewRate={interviewRate}
                avgAlignment={avgAlignment}
                gapTo70={gapTo70}
              />
            </section>
            <OutlookCard
              metrics={{
                expectedLow,
                expectedHigh,
                avgAlignment,
                responseRate: interviewRate,
                gapTo70,
              }}
              applicationsByWeek={getApplicationsByWeek(items)}
              showChart
            />
          </>
        )}

        </div>
        )}
      </div>
    </AppShell>
  );
}

function FitScoreHero({
  avgAlignment,
  insight,
}: {
  avgAlignment: number | null;
  insight: string | null;
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
    <div className="relative">
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <span className="font-display gradient-text text-5xl font-semibold tracking-tight">
          {avgAlignment != null ? `${avgAlignment}%` : "—"}
        </span>
        {qualifier != null && (
          <span className="pb-2 text-sm text-slate-500">{qualifier}</span>
        )}
      </div>
      {insight ? (
        <p className="mt-1 text-sm text-slate-500">{insight}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          Based on resume vs job requirements
        </p>
      )}
      <div className="mt-4">
        <AnimatedBar pct={pct} gradient="linear-gradient(90deg, #22d3ee, #a78bfa)" />
      </div>
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
    <div className="mt-4 space-y-3">
      {deadlines.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onRoleClick(d.id)}
          className="btn-press flex w-full items-center justify-between rounded-xl border border-slate-200 bg-dash-surface p-4 text-left text-sm transition hover:bg-dash-surface/90"
        >
          <span className="flex items-center gap-2">
            {d.isOverdue && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
            )}
            <span className="text-slate-900">
              {d.role} at {d.company}
            </span>
          </span>
          <span
            className={
              d.isOverdue
                ? "text-red-600/90 text-xs font-medium"
                : "text-slate-500"
            }
          >
            {d.daysText}
          </span>
        </button>
      ))}
    </div>
  );
}

const STATUS_ORDER: (keyof FunnelCounts)[] = [
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
  "Wishlist",
];

const STATUS_BAR_COLORS: Record<keyof FunnelCounts, string> = {
  Applied: "bg-cyan-500",
  Interview: "bg-violet-500",
  Offer: "bg-emerald-500",
  Rejected: "bg-rose-500/70",
  Wishlist: "bg-slate-400",
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

const READINESS_LABELS: { key: keyof ReadinessScores; label: string }[] = [
  { key: "resume", label: "Resume strength" },
  { key: "projects", label: "Projects" },
  { key: "deployments", label: "Deployments" },
  { key: "interviewPrep", label: "Interview prep" },
];

function ReadinessBars({ scores }: { scores: ReadinessScores }) {
  return (
    <div className="mt-4 space-y-3">
      {READINESS_LABELS.map(({ key, label }, i) => (
        <div key={key}>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{label}</span>
            <span>{scores[key]}%</span>
          </div>
          <div className="mt-1.5">
            <AnimatedBar pct={scores[key]} colorClassName="bg-cyan-500" delayMs={i * 80} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PerformanceInsight({
  interviewRate,
  avgAlignment: _avgAlignment,
  gapTo70,
}: {
  interviewRate: number | null;
  avgAlignment: number | null;
  gapTo70: number | null;
}) {
  if (interviewRate == null) {
    return (
      <p className="text-sm text-slate-600 leading-relaxed">
        Apply to more roles to measure your response rate. Once you get outcomes,
        we&apos;ll show how you compare to top performers.
      </p>
    );
  }

  const belowBenchmark = interviewRate < BENCHMARK_RATE;

  if (belowBenchmark) {
    const hasGap = gapTo70 != null && gapTo70 > 10;
    return (
      <p className="text-sm text-slate-600 leading-relaxed">
        Your interview rate is{" "}
        <span className="font-semibold text-slate-900">{interviewRate}%</span>. Top-performing
        users average{" "}
        <span className="font-semibold text-slate-900">{BENCHMARK_RATE}%</span>.{" "}
        {hasGap
          ? "Focus on improving fit score or resume version testing."
          : "Target roles with High fit to improve outcomes."}
      </p>
    );
  }

  return (
    <p className="text-sm text-slate-600 leading-relaxed">
      Your interview rate is{" "}
      <span className="font-semibold text-cyan-600">{interviewRate}%</span>. You&apos;re
      ahead of the curve. Keep targeting high-fit roles.
    </p>
  );
}

