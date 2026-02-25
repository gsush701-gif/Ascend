import type { TrackerStatus } from "../../types/tracker";
import type { FunnelCounts } from "../../lib/dashboardStats";

const STATUS_ORDER: TrackerStatus[] = [
  "Wishlist",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
];

const STATUS_COLORS: Record<TrackerStatus, string> = {
  Wishlist: "bg-white/20",
  Applied: "bg-sky-500/70",
  Interview: "bg-amber-500/70",
  Offer: "bg-emerald-500/70",
  Rejected: "bg-rose-500/50",
};

const STATUS_LABELS: Record<TrackerStatus, string> = {
  Wishlist: "Wishlist",
  Applied: "Applied",
  Interview: "Interview",
  Offer: "Offer",
  Rejected: "Rejected",
};

type FunnelBarProps = {
  counts: FunnelCounts;
  className?: string;
};

export function FunnelBar({ counts, className = "" }: FunnelBarProps) {
  const total = STATUS_ORDER.reduce((s, k) => s + (counts[k] ?? 0), 0);
  if (total === 0) {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/50 ${className}`}
      >
        No applications yet. Add one from the Analyzer.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex h-8 w-full overflow-hidden rounded-xl bg-white/10">
        {STATUS_ORDER.map((status) => {
          const n = counts[status] ?? 0;
          const pct = total ? (n / total) * 100 : 0;
          if (n === 0) return null;
          return (
            <div
              key={status}
              className={`${STATUS_COLORS[status]} progress-bar-fill flex items-center justify-center text-xs font-medium text-white/90`}
              style={{ width: `${pct}%`, minWidth: pct > 0 ? "24px" : 0 }}
              title={`${STATUS_LABELS[status]}: ${n}`}
            >
              {n}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
        {STATUS_ORDER.map((status) => {
          const n = counts[status] ?? 0;
          if (n === 0) return null;
          return (
            <span key={status}>
              <span className="font-medium text-white/80">
                {STATUS_LABELS[status]}: {n}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
