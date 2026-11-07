import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import {
  isChecklistDismissed,
  setChecklistDismissed,
  isChecklistCompleteShown,
  setChecklistCompleteShown,
} from "../../lib/onboarding";

type OnboardingChecklistProps = {
  rolesCount: number;
  hasStatusUpdate: boolean;
  resumeLabUsed: boolean;
  onDismiss?: () => void;
};

export function OnboardingChecklist({
  rolesCount,
  hasStatusUpdate,
  resumeLabUsed,
}: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(isChecklistDismissed());

  const step1Done = rolesCount >= 3;
  const step2Done = hasStatusUpdate;
  const step3Done = resumeLabUsed;
  const allDone = step1Done && step2Done && step3Done;

  const [showCompleteBanner, setShowCompleteBanner] = useState(false);

  useEffect(() => {
    if (!allDone || isChecklistCompleteShown()) return;
    let cancelled = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    // Deferred to a microtask: avoids React's set-state-in-effect cascading-render warning.
    // The "shown" flag is set here, after the cancel check, so a re-run of the effect
    // (React's dev double-run) cannot mark it shown without the banner ever appearing.
    Promise.resolve().then(() => {
      if (cancelled) return;
      setChecklistCompleteShown();
      setShowCompleteBanner(true);
      hideTimer = setTimeout(() => setShowCompleteBanner(false), 5000);
    });
    return () => {
      cancelled = true;
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [allDone]);

  if (dismissed) return null;
  if (allDone) {
    if (showCompleteBanner) {
      return (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-4">
          <p className="text-sm font-medium text-cyan-700">
            Onboarding complete.
          </p>
        </div>
      );
    }
    return null;
  }

  const doneCount = [step1Done, step2Done, step3Done].filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-900">Get started</span>
          <span className="text-xs text-slate-500">{doneCount} of 3 done</span>
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <span
              className="block h-full rounded-full bg-cyan-500 transition-[width]"
              style={{ width: `${(doneCount / 3) * 100}%` }}
            />
          </span>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2">
          <Step done={step1Done} label="Add 3 roles" onClick={() => navigate("/analyzer")} />
          <Step done={step2Done} label="Update a role's status" onClick={() => navigate("/roles")} />
          <Step done={step3Done} label="Run 1 resume improvement" onClick={() => navigate("/resume-lab")} />
        </div>
        <button
          type="button"
          onClick={() => {
            setChecklistDismissed();
            setDismissed(true);
          }}
          className="text-xs text-slate-400 transition hover:text-slate-600"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function Step({
  done,
  label,
  onClick,
}: {
  done: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/30 text-cyan-600">
          <Check className="h-3 w-3" />
        </span>
      ) : (
        <span className="h-5 w-5 rounded-full border border-slate-300" />
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={done}
        className={`text-sm ${done ? "text-slate-500" : "text-slate-800 hover:text-slate-900"}`}
      >
        {label}
      </button>
    </div>
  );
}
