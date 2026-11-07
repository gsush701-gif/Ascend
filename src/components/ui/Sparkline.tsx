type SparklineProps = {
  /** The values to draw, oldest first. Needs at least two to draw a line. */
  values: number[];
  className?: string;
  /** Stroke and fill colour; defaults to the app's cyan. */
  color?: string;
  height?: number;
};

/**
 * A tiny line chart with no axes, for putting a trend next to a number. Fixed
 * 100x28 drawing that stretches to the width of its box. Renders a flat dotted
 * baseline when there is nothing to draw, so the row keeps its height.
 */
export function Sparkline({ values, className = "", color = "#06b6d4", height = 28 }: SparklineProps) {
  const W = 100;
  const H = 28;
  const pad = 2;

  if (values.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} style={{ height }} aria-hidden>
        <line x1={0} y1={H - pad} x2={W} y2={H - pad} stroke="#e2e8f0" strokeWidth={1.5} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  const points = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M${points.join(" L")}`;
  const area = `${line} L${W},${H} L0,${H} Z`;
  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
