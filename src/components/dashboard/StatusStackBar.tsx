import type { TrackerStatus } from "../../types/tracker";
import { TRACKER_STATUS_ORDER } from "../../types/tracker";
import type { FunnelCounts } from "../../lib/dashboardStats";

const FUNNEL_ORDER: TrackerStatus[] = TRACKER_STATUS_ORDER;

/** Muted status colors - no loud gold/maroon */
const SEGMENT_COLORS: Record<TrackerStatus, string> = {
  Wishlist: "bg-slate-600/50",
  Analyzed: "bg-slate-500/40",
  "Ready to Apply": "bg-slate-400/50",
  Applied: "bg-slate-500/70",
  "Recruiter Contact": "bg-slate-400/70",
  Interview: "bg-slate-400/60",
  "Technical Interview": "bg-cyan-400/60",
  "Final Interview": "bg-cyan-500/60",
  Offer: "bg-cyan-500/70",
  Accepted: "bg-cyan-600/70",
  Rejected: "bg-slate-600/50",
  Withdrawn: "bg-slate-600/40",
};

const SEGMENT_BG_LEGEND: Record<TrackerStatus, string> = SEGMENT_COLORS;

type StatusStackBarProps = {
  counts: FunnelCounts;
  total: number;
  height?: number;
};

export function StatusStackBar({
  counts,
  total,
  height = 48,
}: StatusStackBarProps) {
  if (total === 0) return null;

  const segments = FUNNEL_ORDER.filter((s) => (counts[s] ?? 0) > 0).map(
    (status) => ({
      status,
      count: counts[status] ?? 0,
      pct: ((counts[status] ?? 0) / total) * 100,
    })
  );

  if (segments.length === 0) return null;

  return (
    <div className="space-y-2">
      <div
        className="flex h-full w-full overflow-hidden rounded-lg"
        style={{ height }}
      >
        {segments.map(({ status, count, pct }) => (
          <div
            key={status}
            className={`${SEGMENT_COLORS[status]} flex min-w-0 items-center justify-center transition-all`}
            style={{ width: `${pct}%` }}
            title={`${status}: ${count} (${Math.round(pct)}%)`}
          >
            {pct >= 12 && (
              <span className="truncate px-1.5 text-[10px] font-medium text-slate-800">
                {count}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[10px]">
        {segments.map(({ status, count }) => (
          <span
            key={status}
            className="flex items-center gap-1 text-slate-500"
            title={`${status}: ${count}`}
          >
            <span
              className={`inline-block h-1.5 w-2.5 shrink-0 rounded-sm ${SEGMENT_BG_LEGEND[status]}`}
            />
            <span className="font-medium text-slate-500">{status}</span>
            <span>{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
