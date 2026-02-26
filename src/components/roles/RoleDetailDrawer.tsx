import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { alignmentToPreparedness } from "../../lib/preparedness";
import { Panel } from "../ui/Panel";
import type { TrackerItem, TrackerStatus } from "../../types/tracker";
import { MissingSignals } from "../../features/analyzer/components/MissingSignals";
import { ActionsList } from "../../features/analyzer/components/ActionsList";

const STATUS_OPTIONS: TrackerStatus[] = [
  "Wishlist",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
];

type RoleDetailDrawerProps = {
  item: TrackerItem;
  onClose: () => void;
  updateStatus: (id: string, status: TrackerStatus) => void;
  updateNextStep: (id: string, next: string) => void;
  updateNotes: (id: string, notes: string) => void;
  updateDeadline: (id: string, deadline: string) => void;
  removeItem: (id: string) => void;
};

export function RoleDetailDrawer({
  item,
  onClose,
  updateStatus,
  updateNextStep,
  updateNotes,
  updateDeadline,
  removeItem,
}: RoleDetailDrawerProps) {
  const navigate = useNavigate();
  const snap = item.reportSnapshot;
  const alignment = snap?.alignment ?? item.alignment;
  const missingSignals = snap?.missingSignals ?? [];
  const actions = snap?.actions ?? [];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleRemove = () => {
    if (window.confirm("Remove this role from your list?")) {
      removeItem(item.id);
      onClose();
    }
  };

  return (
    <aside
      className="fixed right-0 top-0 z-40 flex h-full w-[400px] shrink-0 flex-col border-l border-white/10 bg-[#0d1117] shadow-xl animate-drawer-slide-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0d1117] px-4 py-3 pt-16">
        <h2 id="drawer-title" className="truncate text-base font-semibold text-white">
          {item.role} at {item.company}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <Panel>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{item.role}</h3>
                <p className="mt-1 text-sm text-white/60">{item.company}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-white">
                  {alignmentToPreparedness(alignment)}
                </div>
                <div className="text-xs text-white/55">Preparedness</div>
              </div>
            </div>
          </Panel>

          <Panel title="Application status" subtitle="Track your progress.">
            <select
              value={item.status}
              onChange={(e) =>
                updateStatus(item.id, e.target.value as TrackerStatus)
              }
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="mt-4">
              <label className="block text-xs text-white/55">Next step</label>
              <input
                type="text"
                value={item.nextStep}
                onChange={(e) => updateNextStep(item.id, e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none"
                placeholder="e.g. Apply by Friday"
              />
            </div>
            <div className="mt-4">
              <label className="block text-xs text-white/55">Deadline</label>
              <input
                type="text"
                value={item.deadline ?? ""}
                onChange={(e) => updateDeadline(item.id, e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none"
                placeholder="e.g. Feb 15"
              />
            </div>
          </Panel>

          <Panel title="Notes" subtitle="Free-form notes for this role.">
            <textarea
              value={item.notes ?? ""}
              onChange={(e) => updateNotes(item.id, e.target.value)}
              placeholder="Deadlines, contact, follow-ups..."
              rows={3}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none"
            />
          </Panel>

          {missingSignals.length > 0 && (
            <Panel title="Skill gaps" subtitle="Focus on these to improve fit.">
              <MissingSignals signals={missingSignals} resumeStrength={null} />
            </Panel>
          )}

          {actions.length > 0 && (
            <Panel
              title="Suggested improvements"
              subtitle="From your last analysis."
            >
              <ActionsList actions={actions} />
            </Panel>
          )}

          {!snap && (
            <Panel>
              <p className="text-sm text-white/60">
                No analysis yet. Run the Analyzer for this role to see skill gaps
                and improvements.
              </p>
            </Panel>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                navigate("/analyzer", {
                  state: {
                    roleId: item.id,
                    jobDescription: item.jobDescription,
                    previousReport: snap ? { alignment: snap.alignment, coverage: snap.coverage } : undefined,
                  },
                });
                }}
                className="btn-press flex-1 rounded-xl bg-cyan-500 py-2.5 px-4 text-sm font-semibold text-black transition hover:bg-cyan-400"
              >
                Re-analyze
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/resume-lab", { state: item.jobDescription ? { jobDescription: item.jobDescription } : undefined });
                }}
                className="btn-press rounded-xl border border-white/20 bg-white/5 py-2.5 px-4 text-sm font-medium text-white/80 transition hover:bg-white/10"
              >
                Improve bullets
              </button>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="btn-press rounded-xl py-2.5 px-4 text-sm font-medium text-white/60 transition hover:bg-rose-500/10 hover:text-rose-400"
            >
              Remove role
            </button>
          </div>
        </div>
      </aside>
  );
}
