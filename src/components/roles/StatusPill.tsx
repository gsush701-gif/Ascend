import type { TrackerStatus } from "../../types/tracker";

/** Pipeline-stage colors — shared with the dashboard's status bars (STATUS_COLORS). */
export const PILL_STYLES: Record<TrackerStatus, string> = {
  Wishlist: "border-slate-300 bg-slate-900/[0.04] text-slate-600",
  Analyzed: "border-indigo-400/40 bg-indigo-500/10 text-indigo-600",
  "Ready to Apply": "border-cyan-400/30 bg-cyan-500/10 text-cyan-600",
  Applied: "border-cyan-500/40 bg-cyan-500/15 text-cyan-700",
  "Recruiter Contact": "border-violet-400/30 bg-violet-500/10 text-violet-600",
  Interview: "border-violet-500/40 bg-violet-500/15 text-violet-700",
  "Technical Interview": "border-violet-600/40 bg-violet-600/15 text-violet-800",
  "Final Interview": "border-purple-600/40 bg-purple-600/15 text-purple-800",
  Offer: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700",
  Accepted: "border-emerald-600/50 bg-emerald-600/20 text-emerald-800",
  Rejected: "border-rose-500/30 bg-rose-500/10 text-rose-700/90",
  Withdrawn: "border-slate-400/30 bg-slate-500/10 text-slate-500",
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
