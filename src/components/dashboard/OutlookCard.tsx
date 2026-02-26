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

const ACCENT = "#2dd4bf";

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
    <div className="rounded-xl border border-white/5 bg-dash-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">Interview outlook</h2>
        <p className="mt-0.5 text-xs text-gray-400">
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
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, maxApps]}
                    hide
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(13,17,23,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number | undefined) => [
                      value ?? 0,
                      "Applications",
                    ]}
                    labelFormatter={(label) => label}
                  />
                  <Bar
                    dataKey="applications"
                    fill={ACCENT}
                    radius={[4, 4, 0, 0]}
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
      <div className="text-[10px] uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div
        className={`mt-0.5 text-lg font-semibold ${
          highlight ? "text-cyan-400" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
