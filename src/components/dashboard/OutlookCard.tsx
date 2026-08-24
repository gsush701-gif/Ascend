import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ApplicationsByWeekPoint } from "../../lib/dashboardStats";
import { EmptyChartState } from "../ui/EmptyChartState";

type OutlookMetrics = {
  expectedLow: number;
  expectedHigh: number;
  avgAlignment: number | null;
  responseRate: number | null;
  gapTo70: number | null;
};

type OutlookCardProps = {
  metrics: OutlookMetrics;
  applicationsByWeek: ApplicationsByWeekPoint[];
  showChart?: boolean;
};

export function OutlookCard({
  metrics,
  applicationsByWeek,
  showChart = true,
}: OutlookCardProps) {
  const hasData = applicationsByWeek.length > 0;
  const maxApps = Math.max(
    ...applicationsByWeek.map((p) => p.applications),
    1
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-dash-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Interview outlook</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Projection based on your data — no manual input.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2">
          <MetricBlock
            label="Expected interviews"
            value={
              metrics.responseRate != null
                ? metrics.expectedLow === metrics.expectedHigh
                  ? String(metrics.expectedLow)
                  : `${metrics.expectedLow}–${metrics.expectedHigh}`
                : "—"
            }
          />
          <MetricBlock
            label="Interview rate"
            value={metrics.responseRate != null ? `${metrics.responseRate}%` : "—"}
          />
          <MetricBlock
            label="Avg fit score"
            value={metrics.avgAlignment != null ? `${metrics.avgAlignment}%` : "—"}
          />
          <MetricBlock
            label="Gap to 70%"
            value={
              metrics.gapTo70 != null
                ? metrics.gapTo70 > 0
                  ? `+${metrics.gapTo70}%`
                  : "✓"
                : "—"
            }
            highlight={metrics.gapTo70 != null && metrics.gapTo70 <= 0}
          />
        </div>

        {/* Right: applications over time chart */}
        <div className="min-h-[120px] lg:min-h-[140px]">
          {showChart && hasData ? (
            <div className="h-[120px] w-full lg:h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={applicationsByWeek}
                  margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="outlookBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={1} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, maxApps]}
                    hide
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(15,23,42,0.04)" }}
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                    }}
                    labelStyle={{ color: "#0f172a", fontWeight: 600 }}
                    formatter={(value: number | undefined) => [
                      value ?? 0,
                      "Applications",
                    ]}
                    labelFormatter={(label) => label}
                  />
                  <Bar
                    dataKey="applications"
                    fill="url(#outlookBar)"
                    radius={[4, 4, 0, 0]}
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : showChart ? (
            <EmptyChartState />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-0.5 text-lg font-semibold ${
          highlight ? "text-cyan-600" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
