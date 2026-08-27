import { useMemo, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { EmptyState } from "../components/ui/EmptyState";
import { useTracker } from "../features/tracker/hooks/useTracker";
import { useCareerGoals } from "../features/goals/hooks/useCareerGoals";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/apiError";
import { API_BASE } from "../config/api";
import { getApplicationsSentCount } from "../lib/dashboardStats";
import { getPeriodStats, getReportRecommendations, type ReportPeriod } from "../features/report/stats";
import { useWeeklyReports } from "../features/report/useWeeklyReports";
import { pageHeader, pageTitle, pageSubtitle, card } from "../lib/ui";
import { cn } from "../lib/cn";

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

function PastReportsPanel() {
  const { reports, loading } = useWeeklyReports();

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (reports.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No automated reports yet. Turn on "Email me a weekly career report" on your{" "}
        <a href="/profile" className="underline decoration-dotted hover:text-slate-700">
          Profile page
        </a>{" "}
        to start building a weekly history here.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {reports.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
          <div>
            <span className="font-medium text-slate-900">{formatWeekRange(r.weekStart, r.weekEnd)}</span>
            <span className="ml-2 text-slate-500">
              {r.content.stats.applications} application{r.content.stats.applications !== 1 ? "s" : ""} ·{" "}
              {r.content.stats.interviews} interview{r.content.stats.interviews !== 1 ? "s" : ""} ·{" "}
              {r.content.stats.offers} offer{r.content.stats.offers !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-xs text-slate-400">{r.emailSentAt ? "Emailed" : "Generated, not emailed"}</span>
        </li>
      ))}
    </ul>
  );
}

const PERIOD_TABS: { value: ReportPeriod; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={cn(card, "text-center")}>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function Report() {
  const { tracker } = useTracker(undefined);
  const { goals } = useCareerGoals();
  const { session } = useAuth();
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const stats = useMemo(() => getPeriodStats(tracker, period), [tracker, period]);
  const recommendations = useMemo(() => getReportRecommendations(tracker, goals), [tracker, goals]);
  const totalApplied = getApplicationsSentCount(tracker);

  async function generateSummary() {
    setSummaryLoading(true);
    setSummaryError(null);
    setSummary(null);
    try {
      const res = await fetch(`${API_BASE}/api/report-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          stats: {
            period: stats.periodLabel,
            applications: stats.applications,
            interviews: stats.interviews,
            offers: stats.offers,
            responseRatePercent: stats.responseRatePercent,
            sampleTooSmall: stats.sampleTooSmall,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to generate summary"));
      setSummary(data.summary);
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "Failed to generate summary");
    } finally {
      setSummaryLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className={pageHeader}>
          <div>
            <h1 className={pageTitle}>Career report</h1>
            <p className={pageSubtitle}>
              An on-demand snapshot computed live from your own tracked roles, generated whenever
              you want. You can also opt into an automated weekly version emailed to you — turn
              it on from your Profile page.
            </p>
          </div>
        </header>

        {totalApplied === 0 ? (
          <EmptyState
            title="No applications tracked yet"
            subtitle="Once you start applying and tracking roles, this page summarizes your activity and surfaces real patterns worth acting on."
            primaryAction={{ label: "Go to Roles", onClick: () => (window.location.href = "/roles") }}
          />
        ) : (
          <>
            <div className="flex gap-2">
              {PERIOD_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setPeriod(tab.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    period === tab.value
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-[#FFFFFF] text-slate-600 hover:bg-slate-900/[0.04]",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Applications" value={stats.applications} sub={stats.periodLabel} />
              <StatTile label="Interviews" value={stats.interviews} sub={stats.periodLabel} />
              <StatTile label="Offers" value={stats.offers} sub={stats.periodLabel} />
              <StatTile
                label="Response rate"
                value={stats.responseRatePercent != null ? `${stats.responseRatePercent}%` : "—"}
                sub={stats.sampleTooSmall ? "Not enough data yet" : stats.periodLabel}
              />
            </div>

            <Panel
              title="What to do next"
              subtitle="Derived from real patterns in your own tracked roles — never a generic tip."
            >
              <ul className="space-y-2">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 text-cyan-600">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="AI summary" subtitle="One sentence, grounded strictly in the numbers above.">
              {!summary && !summaryLoading && (
                <button
                  type="button"
                  onClick={generateSummary}
                  className="btn-press inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-900/[0.04] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-900/[0.06]"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate summary
                </button>
              )}
              {summaryLoading && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </p>
              )}
              {summaryError && <p className="text-sm text-red-600">{summaryError}</p>}
              {summary && !summaryLoading && (
                <p className="animate-fade-in text-sm leading-relaxed text-slate-800">{summary}</p>
              )}
            </Panel>

            <div className={`${card} text-xs text-slate-400`}>
              Applications/interviews/offers are bucketed by when each role was added to your
              tracker, not by when a status change actually happened (Ascend doesn't record
              per-event history yet) — so an interview reached this week for a role added last
              month shows up under the period it was added, not this one.
            </div>

            <Panel
              title="Past reports"
              subtitle="Automated weekly reports, generated once you opt in from your Profile page — stored as-generated, not recomputed later."
            >
              <PastReportsPanel />
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  );
}
