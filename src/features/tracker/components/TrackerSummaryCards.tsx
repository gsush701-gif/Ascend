import { Card } from "../../../components/ui/Card";
import { cn } from "../../../lib/cn";
import type { TrackerItem, TrackerStatus } from "../../../types/tracker";

function pill(status: TrackerStatus) {
  const base = "inline-flex items-center rounded-xl border px-2.5 py-1 text-xs";
  if (status === "Wishlist")
    return cn(base, "border-zinc-800 bg-zinc-900/50 text-zinc-200");
  if (status === "Applied")
    return cn(base, "border-sky-900/60 bg-sky-950/40 text-sky-200");
  if (status === "Interview")
    return cn(base, "border-amber-900/60 bg-amber-950/40 text-amber-200");
  if (status === "Offer")
    return cn(base, "border-emerald-900/60 bg-emerald-950/40 text-emerald-200");
  return cn(base, "border-rose-900/60 bg-rose-950/40 text-rose-200");
}

type TrackerSummaryCardsProps = {
  tracker: TrackerItem[];
};

export function TrackerSummaryCards({ tracker }: TrackerSummaryCardsProps) {
  const statuses: TrackerStatus[] = ["Wishlist", "Applied", "Interview"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {statuses.map((s) => (
        <Card key={s}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">{s}</div>
            <span className={pill(s)}>
              {tracker.filter((t) => t.status === s).length}
            </span>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            {s === "Wishlist" && "Jobs you're considering."}
            {s === "Applied" && "Submitted applications."}
            {s === "Interview" && "In the pipeline."}
          </div>
        </Card>
      ))}
    </div>
  );
}
