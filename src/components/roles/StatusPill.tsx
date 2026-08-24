import type { TrackerStatus } from "../../types/tracker";

/** Pipeline-stage colors — shared with the dashboard's status bars (STATUS_COLORS). */
export const PILL_STYLES: Record<TrackerStatus, string> = {
  Wishlist: "border-slate-300 bg-slate-900/[0.04] text-slate-600",
  Applied: "border-cyan-500/40 bg-cyan-500/15 text-cyan-700",
  Interview: "border-violet-500/40 bg-violet-500/15 text-violet-700",
  Offer: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700",
  Rejected: "border-rose-500/30 bg-rose-500/10 text-rose-700/90",
};

type StatusPillProps = {
  status: TrackerStatus;
  children?: React.ReactNode;
};

export function StatusPill({ status, children }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${PILL_STYLES[status]}`}
    >
      {children ?? status}
    </span>
  );
}
