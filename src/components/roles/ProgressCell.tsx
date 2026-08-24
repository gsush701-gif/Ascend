import { alignmentToPreparedness } from "../../lib/preparedness";

type ProgressCellProps = {
  value: number;
  /** bar color: teal for high, slate for neutral, muted for low */
  variant?: "alignment" | "conversion";
};

const ALIGNMENT_COLOR = (pct: number) =>
  pct >= 70
    ? "bg-cyan-500/70"
    : pct >= 50
      ? "bg-slate-400/60"
      : "bg-slate-600/50";

const CONVERSION_COLOR = (pct: number) =>
  pct >= 100 ? "bg-cyan-500/70" : pct >= 50 ? "bg-slate-400/60" : "bg-slate-600/50";

export function ProgressCell({
  value,
  variant = "alignment",
}: ProgressCellProps) {
  const pct = Math.max(0, Math.min(100, value));
  const barColor =
    variant === "alignment" ? ALIGNMENT_COLOR(pct) : CONVERSION_COLOR(pct);

  const label =
    variant === "alignment"
      ? alignmentToPreparedness(pct)
      : `${pct}%`;

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-slate-900/[0.06]">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums text-slate-700">
        {label}
      </span>
    </div>
  );
}
