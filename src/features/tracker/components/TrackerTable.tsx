import { FileText, Trash2 } from "lucide-react";
import { cn } from "../../../lib/cn";
import type { TrackerItem, TrackerStatus } from "../../../types/tracker";

type TrackerTableProps = {
  tracker: TrackerItem[];
  filter: "All" | "Applied" | "Interview";
  onFilterChange: (f: "All" | "Applied" | "Interview") => void;
  onStatusChange: (id: string, status: TrackerStatus) => void;
  onNextStepChange: (id: string, next: string) => void;
  onRemove: (id: string) => void;
  onSeeReport: (item: TrackerItem) => void;
};

export function TrackerTable({
  tracker,
  filter,
  onFilterChange,
  onStatusChange,
  onNextStepChange,
  onRemove,
  onSeeReport,
}: TrackerTableProps) {
  const filtered = tracker
    .slice()
    .sort((a, b) => b.alignment - a.alignment)
    .filter((x) =>
      filter === "All" ? true : x.status === filter
    );

  return (
    <>
      {tracker.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-[0.18em] text-zinc-500">
              Filter
            </span>
            <div className="inline-flex rounded-2xl border border-zinc-800 bg-zinc-950/60 p-1">
              {(["All", "Applied", "Interview"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFilterChange(f)}
                  className={cn(
                    "px-3 py-1 rounded-2xl text-[11px]",
                    filter === f ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="text-xs text-zinc-500">
            Sorted by alignment (highest first)
          </div>
        </div>
      )}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr className="border-b border-zinc-900">
              <th className="py-3 pr-4">Company</th>
              <th className="py-3 pr-4">Role</th>
              <th className="py-3 pr-4">Date applied</th>
              <th className="py-3 pr-4">Alignment</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Next step</th>
              <th className="py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-zinc-500">
                  No tracked applications yet. Analyze a job and "Save to
                  Tracker".
                </td>
              </tr>
            ) : (
              filtered.map((x) => (
                <tr key={x.id} className="border-b border-zinc-900/70">
                  <td className="py-4 pr-4 font-medium">{x.company}</td>
                  <td className="py-4 pr-4 text-zinc-300">{x.role}</td>
                  <td className="py-4 pr-4 text-xs text-zinc-500">
                    {new Date(x.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400 w-10">
                        {x.alignment}%
                      </span>
                      <div className="h-1.5 w-24 rounded-full bg-zinc-900 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-zinc-100/80"
                          style={{
                            width: `${Math.max(0, Math.min(100, x.alignment))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <select
                      value={x.status}
                      onChange={(e) =>
                        onStatusChange(x.id, e.target.value as TrackerStatus)
                      }
                      className={cn(
                        "rounded-xl px-2.5 py-1 text-xs border bg-transparent",
                        x.status === "Wishlist" && "border-zinc-800 text-zinc-200",
                        x.status === "Applied" && "border-sky-900/60 text-sky-200",
                        x.status === "Interview" &&
                          "border-amber-900/60 text-amber-200",
                        x.status === "Offer" &&
                          "border-emerald-900/60 text-emerald-200",
                        x.status === "Rejected" &&
                          "border-rose-900/60 text-rose-200"
                      )}
                    >
                      <option>Wishlist</option>
                      <option>Applied</option>
                      <option>Interview</option>
                      <option>Offer</option>
                      <option>Rejected</option>
                    </select>
                  </td>
                  <td className="py-4 pr-4">
                    <input
                      value={x.nextStep}
                      onChange={(e) =>
                        onNextStepChange(x.id, e.target.value)
                      }
                      className="w-full rounded-2xl border border-zinc-900 bg-zinc-950/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-700"
                    />
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {x.reportSnapshot && (
                        <button
                          type="button"
                          onClick={() => onSeeReport(x)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 hover:text-white"
                        >
                          <FileText size={16} />
                          See report
                        </button>
                      )}
                      <button
                        onClick={() => onRemove(x.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-900 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-300 hover:text-white"
                      >
                        <Trash2 size={16} />
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {tracker.length > 0 ? (
        <div className="mt-4 text-xs text-zinc-500">
          Saved locally (localStorage). Next: database + login.
        </div>
      ) : null}
    </>
  );
}
