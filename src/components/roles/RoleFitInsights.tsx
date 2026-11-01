import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { AnimatedBar } from "../ui/AnimatedBar";
import { Panel } from "../ui/Panel";
import { cn } from "../../lib/cn";
import { BREAKDOWN_META, getApplyVerdict, type VerdictLevel } from "../../features/roles/fitAnalysis";
import { getReadiness, readinessProgress, type ReadinessKey } from "../../features/roles/readiness";
import type { SavedReportSnapshot, TrackerItem } from "../../types/tracker";

const VERDICT_STYLE: Record<VerdictLevel, string> = {
  strong: "border-emerald-300 bg-emerald-50 text-emerald-800",
  competitive: "border-cyan-300 bg-cyan-50 text-cyan-800",
  stretch: "border-amber-300 bg-amber-50 text-amber-800",
  longshot: "border-rose-300 bg-rose-50 text-rose-800",
};

function barColor(value: number): string {
  if (value < 40) return "bg-rose-400";
  if (value < 70) return "bg-amber-400";
  return "bg-cyan-500";
}

/**
 * Sits under the big fit score: an honest apply-or-not verdict, and the four
 * parts of the score so a student can see exactly which one is holding it back.
 */
export function FitInsights({ snap }: { snap: SavedReportSnapshot }) {
  const verdict = getApplyVerdict(snap);
  const breakdown = snap.breakdown;

  return (
    <div className="mt-5 space-y-5 border-t border-slate-200 pt-4">
      <div>
        <span
          className={cn(
            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            VERDICT_STYLE[verdict.level],
          )}
        >
          {verdict.label}
        </span>
        <p className="mt-2 text-sm text-slate-700">{verdict.summary}</p>
        {verdict.reasons.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-slate-500">
            {verdict.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Why this score</h3>
        {breakdown ? (
          <div className="space-y-3">
            {(Object.keys(BREAKDOWN_META) as (keyof typeof BREAKDOWN_META)[]).map((key) => {
              const value = breakdown[key];
              if (typeof value !== "number") return null;
              const meta = BREAKDOWN_META[key];
              return (
                <div key={key} title={meta.what}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-800">{meta.label}</span>
                    <span className="text-xs text-slate-500">{value}%</span>
                  </div>
                  <AnimatedBar pct={value} colorClassName={barColor(value)} />
                  <p className="mt-1 text-[11px] text-slate-400">
                    {meta.what} ({meta.weight})
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            This analysis was saved before the score breakdown was kept. Re-analyze to see what's behind it.
          </p>
        )}
      </div>
    </div>
  );
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** A checklist of what's left before this application is ready to send. */
export function ReadinessPanel({ item }: { item: TrackerItem }) {
  const navigate = useNavigate();
  const items = getReadiness(item);
  const { done, total } = readinessProgress(items);

  const actions: Partial<Record<ReadinessKey, { label: string; run: () => void }>> = {
    gaps: { label: "See the gaps", run: () => scrollToId("role-gaps") },
    coverLetter: { label: "Write it", run: () => navigate(`/roles/${item.id}/cover-letter`) },
    interview: { label: "Practise", run: () => navigate(`/roles/${item.id}/interview-prep`) },
    deadline: { label: "Set it", run: () => scrollToId("role-status") },
    applied: { label: "Update status", run: () => scrollToId("role-status") },
  };

  return (
    <Panel title="Before you apply" subtitle={`${done} of ${total} done`}>
      <ul className="space-y-3">
        {items.map((step) => {
          const action = actions[step.key];
          return (
            <li key={step.key} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  step.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white",
                )}
                aria-hidden
              >
                {step.done && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm", step.done ? "text-slate-500" : "font-medium text-slate-900")}>
                  {step.label}
                  <span className="sr-only">{step.done ? " (done)" : " (not done)"}</span>
                </div>
                {!step.done && <p className="text-xs text-slate-500">{step.hint}</p>}
              </div>
              {!step.done && action && (
                <button
                  type="button"
                  onClick={action.run}
                  className="btn-press shrink-0 rounded-lg border border-slate-200 bg-slate-900/[0.04] px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-900/[0.07]"
                >
                  {action.label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
