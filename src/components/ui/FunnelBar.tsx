import type { TrackerStatus } from "../../types/tracker";
import { TRACKER_STATUS_ORDER } from "../../types/tracker";
import type { FunnelCounts } from "../../lib/dashboardStats";

const STATUS_ORDER: TrackerStatus[] = TRACKER_STATUS_ORDER;

const STATUS_COLORS: Record<TrackerStatus, string> = {
  Wishlist: "bg-slate-900/10",
  Analyzed: "bg-indigo-400/60",
  "Ready to Apply": "bg-cyan-400/50",
  Applied: "bg-sky-500/70",
  "Recruiter Contact": "bg-violet-400/50",
  Interview: "bg-amber-500/70",
  "Technical Interview": "bg-orange-500/70",
  "Final Interview": "bg-orange-600/70",
  Offer: "bg-emerald-500/70",
  Accepted: "bg-emerald-600/70",
  Rejected: "bg-rose-500/50",
  Withdrawn: "bg-slate-500/40",
};

const STATUS_LABELS: Record<TrackerStatus, string> = {
  Wishlist: "Wishlist",
  Analyzed: "Analyzed",
  "Ready to Apply": "Ready to Apply",
  Applied: "Applied",
  "Recruiter Contact": "Recruiter Contact",
  Interview: "Interview",
  "Technical Interview": "Technical Interview",
  "Final Interview": "Final Interview",
  Offer: "Offer",
  Accepted: "Accepted",
  Rejected: "Rejected",
  Withdrawn: "Withdrawn",
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
        className={`rounded-2xl border border-slate-200 bg-slate-900/[0.04] p-4 text-center text-sm text-slate-500 ${className}`}
      >
        No applications yet. Add one from the Analyzer.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex h-8 w-full overflow-hidden rounded-xl bg-slate-900/[0.06]">
        {STATUS_ORDER.map((status) => {
          const n = counts[status] ?? 0;
          const pct = total ? (n / total) * 100 : 0;
          if (n === 0) return null;
          return (
            <div
              key={status}
              className={`${STATUS_COLORS[status]} progress-bar-fill flex items-center justify-center text-xs font-medium text-slate-800`}
              style={{ width: `${pct}%`, minWidth: pct > 0 ? "24px" : 0 }}
              title={`${STATUS_LABELS[status]}: ${n}`}
            >
              {n}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {STATUS_ORDER.map((status) => {
          const n = counts[status] ?? 0;
          if (n === 0) return null;
          return (
            <span key={status}>
              <span className="font-medium text-slate-700">
                {STATUS_LABELS[status]}: {n}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
