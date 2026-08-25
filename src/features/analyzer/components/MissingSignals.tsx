import type { ResumeStrength, SignalState } from "../../../types/analyzer";
import {
  getFixPlanForSignal,
  getSignalDisplay,
  getSignalWhyItMatters,
  getTangibleResumeExample,
  matchSignalKey,
} from "../utils";

export type SignalPriority = "high" | "medium" | "low";

function getPriority(index: number): SignalPriority {
  if (index <= 1) return "high";
  if (index <= 3) return "medium";
  return "low";
}

type MissingSignalsProps = {
  signals: string[];
  resumeStrength: ResumeStrength | null;
};

export function MissingSignals({ signals, resumeStrength }: MissingSignalsProps) {
  if (signals.length === 0) return null;

  return (
    <div className="mb-2">
      <div className="text-xs text-slate-500 mb-4">
        High = required · Medium = nice to have · Low = bonus
      </div>
      <div className="space-y-3">
        {signals.map((sig, i) => {
          const priority = getPriority(i);
          const why = getSignalWhyItMatters(sig);
          const plan = getFixPlanForSignal(sig);
          const example = getTangibleResumeExample(sig);
          const signalKey = matchSignalKey(sig);
          const useConsistentCopy =
            signalKey && resumeStrength?.signals[signalKey] != null;
          const display = useConsistentCopy
            ? getSignalDisplay(
                signalKey,
                resumeStrength!.signals[signalKey] as SignalState
              )
            : null;

          const priorityBorder =
            priority === "high"
              ? "border-rose-500/70"
              : priority === "medium"
                ? "border-amber-500/60"
                : "border-slate-300";
          const priorityBadge =
            priority === "high"
              ? "bg-rose-500/15 text-rose-700"
              : priority === "medium"
                ? "bg-amber-500/15 text-amber-700"
                : "bg-slate-900/[0.06] text-slate-600";

          return (
            <div
              key={i}
              className={`group relative flex flex-col gap-2 rounded-xl border-l-4 ${priorityBorder} bg-dash-surface pl-4 pr-3 py-3 text-sm text-slate-700`}
              title={`Why it matters: ${why}`}
            >
              <div className="mb-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${priorityBadge}`}
                >
                  {priority} priority
                </span>
              </div>
              <div className="min-w-0 flex-1">
                {display ? (
                  <span className="text-slate-900">
                    <span className="mr-1.5">{display.icon}</span>
                    <span className="font-medium">{display.label}: </span>
                    {display.message}
                  </span>
                ) : (
                  <>
                    <span className="font-medium text-slate-900">{sig}</span>
                    <span className="text-slate-400 mx-2">→</span>
                    <span className="text-amber-700/90">{plan.action}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      ({plan.days} day{plan.days !== 1 ? "s" : ""})
                    </span>
                  </>
                )}
                <div className="pointer-events-none absolute bottom-full left-0 right-0 z-10 mb-1 hidden rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-xl group-hover:block">
                  <span className="font-medium text-rose-700">
                    Why it matters:
                  </span>{" "}
                  {why}
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs">
                <span className="text-emerald-600 shrink-0">✅</span>
                <span className="text-slate-700">
                  Add: &ldquo;{example}&rdquo;
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
