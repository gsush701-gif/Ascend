import type { AlignmentPoint } from "../../lib/dashboardStats";

type AlignmentChartProps = {
  points: AlignmentPoint[];
  height?: number;
  className?: string;
};

export function AlignmentChart({
  points,
  height = 120,
  className = "",
}: AlignmentChartProps) {
  if (points.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-white/50 ${className}`}
        style={{ height }}
      >
        No alignment history yet
      </div>
    );
  }

  const minA = Math.min(0, ...points.map((p) => p.alignment));
  const maxA = Math.max(100, ...points.map((p) => p.alignment));
  const range = maxA - minA || 1;
  const width = 100;
  const padding = { top: 8, right: 8, bottom: 8, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const toX = (i: number) =>
    padding.left +
    (points.length === 1 ? 0 : (i / Math.max(1, points.length - 1)) * chartWidth);
  const toY = (a: number) =>
    padding.top + chartHeight - ((a - minA) / range) * chartHeight;

  const pathD =
    points.length === 1
      ? `M ${padding.left} ${toY(points[0].alignment)} L ${padding.left + chartWidth} ${toY(points[0].alignment)}`
      : points
          .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.alignment)}`)
          .join(" ");

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        style={{ minHeight: height }}
      >
        <path
          d={pathD}
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="progress-bar-fill"
        />
      </svg>
    </div>
  );
}
