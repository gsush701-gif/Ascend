import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Panel } from "../components/ui/Panel";
import { useTracker } from "../features/tracker/hooks/useTracker";
import {
  getApplicationsSentCount,
  getApplicationsThisWeek,
  getInterviewCount,
  getAverageAlignment,
  getResponseRate,
  getAlignmentTrend,
  getExpectedInterviewsRange,
  getAlignmentHistoryFromTracker,
} from "../lib/dashboardStats";
export function Insights() {
  const { tracker: items } = useTracker(undefined);

  const applicationsSent = getApplicationsSentCount(items);
  const applicationsThisWeek = getApplicationsThisWeek(items);
  const interviewsTotal = getInterviewCount(items);
  const avgAlignment = getAverageAlignment(items);
  const responseRate = getResponseRate(items);
  const trend = getAlignmentTrend(items, 8);
  const { low: expectedLow, high: expectedHigh } = getExpectedInterviewsRange(
    applicationsSent,
    responseRate
  );
  const history = getAlignmentHistoryFromTracker(items, 10);

  return (
    <AppShell>
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-white">Insights</h1>
          <p className="mt-1 text-sm text-white/60">
            Performance and projections from your role data.
          </p>
        </header>

        {/* Section 1: Weekly Performance */}
        <Panel
          title="Weekly performance"
          subtitle="Activity and alignment from your tracker."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Applications this week"
              value={applicationsThisWeek}
              sub="roles added as applied"
            />
            <StatCard
              label="Interviews"
              value={interviewsTotal}
              sub="scheduled or offer"
            />
            <StatCard
              label="Alignment average"
              value={avgAlignment != null ? `${avgAlignment}%` : "—"}
              sub="across tracked roles"
            />
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50">Trend</div>
              <div className="mt-1 flex items-center gap-2">
                {trend === "up" && (
                  <>
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-400">
                      Improving
                    </span>
                  </>
                )}
                {trend === "down" && (
                  <>
                    <TrendingDown className="h-5 w-5 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">
                      Declining
                    </span>
                  </>
                )}
                {trend === "stable" && (
                  <>
                    <Minus className="h-5 w-5 text-white/50" />
                    <span className="text-sm font-medium text-white/70">
                      Stable
                    </span>
                  </>
                )}
                {trend === null && (
                  <span className="text-sm text-white/50">Need more data</span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-white/45">
                From recent alignment history
              </p>
            </div>
          </div>
          {responseRate !== null && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-white/50">Response rate</div>
              <div className="text-lg font-semibold text-white">
                {responseRate}%
              </div>
              <p className="text-[11px] text-white/45">
                Interviews (or offers) ÷ applications sent
              </p>
            </div>
          )}
        </Panel>

        {/* Section 2: Acceptance probability calculator (automatic) */}
        <Panel
          title="Interview outlook"
          subtitle="Projection based on your data — no manual input."
        >
          {applicationsSent === 0 ? (
            <p className="text-sm text-white/60">
              Add and apply to roles to see your expected interview range here.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-white/80">
                You’ve applied to{" "}
                <span className="font-semibold text-white">
                  {applicationsSent} role{applicationsSent !== 1 ? "s" : ""}
                </span>
                {avgAlignment != null && (
                  <>
                    {" "}
                    with{" "}
                    <span className="font-semibold text-white">
                      {avgAlignment}%
                    </span>{" "}
                    average alignment.
                  </>
                )}{" "}
                {responseRate != null ? (
                  <>
                    Based on your current response rate ({responseRate}%),
                    expected interviews:{" "}
                    <span className="font-semibold text-white">
                      {expectedLow === expectedHigh
                        ? expectedLow
                        : `${expectedLow}–${expectedHigh}`}
                    </span>
                    .
                  </>
                ) : (
                  <>
                    Once you get interview outcomes, we’ll show expected
                    interview range here.
                  </>
                )}
              </p>
              {history.length >= 2 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
                    <BarChart3 className="h-4 w-4" />
                    Alignment over time
                  </div>
                  <div className="flex items-end gap-1 h-10">
                    {history.map((p, i) => (
                      <div
                        key={i}
                        className="flex-1 min-w-0 rounded-t bg-white/20"
                        style={{
                          height: `${Math.max(8, (p.alignment / 100) * 100)}%`,
                        }}
                        title={`${p.alignment}%`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-white/45">
                    <span>Older</span>
                    <span>Recent</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
      <p className="mt-0.5 text-[11px] text-white/45">{sub}</p>
    </div>
  );
}
