import type { TrackerStatus } from "../../types/tracker";

/** Muted status colors - consistent with dashboard */
const PILL_STYLES: Record<TrackerStatus, string> = {
  Wishlist: "border-white/15 bg-white/5 text-white/70",
  Applied: "border-slate-500/40 bg-slate-500/20 text-slate-300",
  Interview: "border-slate-400/40 bg-slate-400/20 text-slate-300",
  Offer: "border-cyan-500/50 bg-cyan-500/20 text-cyan-300",
  Rejected: "border-slate-600/40 bg-slate-600/20 text-slate-400",
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
