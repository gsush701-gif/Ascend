import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { buildNextSteps } from "../../features/analyzer/inputChecks";
import { groupSkills } from "../../features/analyzer/skillGroups";
import { getFixPlanForSignal } from "../../features/analyzer/utils";
import { cardAlt } from "../../lib/ui";
import { cn } from "../../lib/cn";
import type { TrackerItem } from "../../types/tracker";

type Props = { item: TrackerItem };

function Pill({ children, tone }: { children: React.ReactNode; tone: "required" | "optional" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
        tone === "required"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
          : "border-slate-200 bg-slate-900/5 text-slate-500",
      )}
    >
      {children}
    </span>
  );
}

/**
 * The role page's version of the Analyzer's gap view, built from the saved
 * analysis: next steps, the skills the posting asks for that the resume
 * doesn't show (required first), what's already covered, and the resume
 * signals worth fixing. Same information and tone as the Analyzer, in place of
 * the old signals-only box and its example bullets with made-up numbers.
 */
export function RoleGapsPanel({ item }: Props) {
  const navigate = useNavigate();
  const snap = item.reportSnapshot;
  if (!snap) return null;

  const groups = groupSkills(snap.skills);
  const signals = snap.missingSignals ?? [];
  const steps = buildNextSteps(
    {
      alignment: snap.alignment,
      skills: snap.skills ?? [],
      missingSignals: signals,
    },
    { fixHint: 'Use "Write bullets to close these gaps" below.' },
  );
  const nothingMissing = groups.missingRequired.length === 0 && groups.missingPreferred.length === 0;

  return (
    <div className="space-y-5">
      {steps.length > 0 && (
        <div className={cn(cardAlt, "p-4")}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Your next steps</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-800">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Missing from your resume
        </h3>
        {nothingMissing ? (
          <p className="text-sm text-slate-600">
            Nothing missing: your resume covers every skill this posting lists.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {groups.missingRequired.map((name) => (
              <li key={name} className="flex items-center gap-2 text-sm text-slate-800">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                {name}
                <Pill tone="required">Required</Pill>
              </li>
            ))}
            {groups.missingPreferred.map((name) => (
              <li key={name} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                {name}
                <Pill tone="optional">Nice-to-have</Pill>
              </li>
            ))}
          </ul>
        )}
      </div>

      {groups.matched.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-500 hover:text-slate-700">
            Already on your resume ({groups.matched.length})
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {groups.matched.map((name) => (
              <span
                key={name}
                className="rounded-full border border-cyan-500/25 bg-cyan-500/[0.07] px-2.5 py-0.5 text-xs text-slate-700"
              >
                {name}
              </span>
            ))}
          </div>
        </details>
      )}

      {signals.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Resume signals to fix
          </h3>
          <ul className="space-y-2">
            {signals.map((sig) => {
              const plan = getFixPlanForSignal(sig);
              return (
                <li key={sig} className="text-sm text-slate-800">
                  {sig}
                  <span className="block text-xs text-slate-500">
                    Quick fix: {plan.action} (about {plan.days} day{plan.days === 1 ? "" : "s"})
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!nothingMissing && item.jobDescription && (
        <button
          type="button"
          onClick={() => navigate("/analyzer", { state: { jobDescription: item.jobDescription } })}
          className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-900/[0.04] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/[0.07]"
        >
          Write bullets to close these gaps
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
