import { X } from "lucide-react";
import type { TrackerItem } from "../../../types/tracker";
import { MissingSignals } from "../../analyzer/components/MissingSignals";
import { ActionsList } from "../../analyzer/components/ActionsList";

type SavedReportModalProps = {
  item: TrackerItem;
  onClose: () => void;
};

export function SavedReportModal({ item, onClose }: SavedReportModalProps) {
  const snap = item.reportSnapshot;
  if (!snap) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {item.company} · {item.role}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Saved {new Date(item.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-xs text-zinc-500">Alignment</div>
              <div className="text-2xl font-semibold text-zinc-100">
                {snap.alignment}%
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Coverage</div>
              <div className="text-xl font-semibold text-zinc-100">
                {snap.coverage}%
              </div>
            </div>
            {snap.resumeStrengthAtSave != null && (
              <div>
                <div className="text-xs text-zinc-500">Resume strength</div>
                <div className="text-xl font-semibold text-zinc-100">
                  {snap.resumeStrengthAtSave}/100
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-400 mb-2">
              Core skills match
            </h3>
            <div className="space-y-2">
              {snap.skills.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    {s.status === "hit" ? (
                      <span className="text-emerald-400">✓</span>
                    ) : (
                      <span className="text-rose-400">✕</span>
                    )}
                    <span className="text-sm text-zinc-200">{s.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {snap.missingSignals.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-400 mb-2">
                Missing signals
              </h3>
              <MissingSignals
                signals={snap.missingSignals}
                resumeStrength={null}
              />
            </div>
          )}

          {snap.actions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-400 mb-2">
                Recommended actions
              </h3>
              <ActionsList actions={snap.actions} />
            </div>
          )}

          {snap.alignmentHistory.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-400 mb-2">
                Alignment history (at save)
              </h3>
              <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                {snap.alignmentHistory.slice(0, 10).map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-400">
                      {new Date(h.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="font-semibold text-zinc-100">
                      {h.alignment}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
