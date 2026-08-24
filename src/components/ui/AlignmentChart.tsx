import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { AlignmentPoint } from "../../lib/dashboardStats";

type AlignmentChartProps = {
  points: AlignmentPoint[];
  height?: number;
  className?: string;
};

export function AlignmentChart({
  points,
  height = 160,
  className = "",
}: AlignmentChartProps) {
  if (points.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-900/[0.02] text-sm text-slate-500 ${className}`}
        style={{ height }}
      >
        No alignment history yet
      </div>
    );
  }

  const data = points.map((p) => ({
    label: new Date(p.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    alignment: p.alignment,
  }));

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="alignmentFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="alignmentStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.06)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis domain={[0, 100]} hide />
          <Tooltip
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              fontSize: "12px",
              boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
            }}
            labelStyle={{ color: "#0f172a", fontWeight: 600 }}
            formatter={(value: number | undefined) => [`${value}%`, "Fit score"]}
          />
          <Area
            type="monotone"
            dataKey="alignment"
            stroke="url(#alignmentStroke)"
            strokeWidth={2.5}
            fill="url(#alignmentFill)"
            dot={{ r: 3, fill: "#22d3ee", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#22d3ee", stroke: "#FFFFFF", strokeWidth: 2 }}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
