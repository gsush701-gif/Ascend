import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
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
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(isChecklistDismissed());

  const step1Done = rolesCount >= 3;
  const step2Done = hasStatusUpdate;
  const step3Done = resumeLabUsed;
  const allDone = step1Done && step2Done && step3Done;

  const [showCompleteBanner, setShowCompleteBanner] = useState(false);

  useEffect(() => {
    if (allDone && !isChecklistCompleteShown()) {
      setChecklistCompleteShown();
      setShowCompleteBanner(true);
      const t = setTimeout(() => setShowCompleteBanner(false), 5000);
      return () => clearTimeout(t);
    }
  }, [allDone]);

  if (dismissed) return null;
  if (allDone) {
    if (showCompleteBanner) {
      return (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
          <p className="text-sm font-medium text-cyan-700">
            Onboarding complete.
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-900/[0.04] p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-slate-900">
          Get started
        </span>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        )}
      </button>
      {!collapsed && (
        <div className="mt-3 space-y-2">
          <Step
            done={step1Done}
            label="Add 3 roles"
            onClick={() => navigate("/analyzer")}
          />
          <Step
            done={step2Done}
            label="Update status for at least 1 role"
            onClick={() => navigate("/roles")}
          />
          <Step
            done={step3Done}
            label="Run 1 resume improvement"
            onClick={() => navigate("/resume-lab")}
          />
          <button
            type="button"
            onClick={() => {
              setChecklistDismissed();
              setDismissed(true);
            }}
            className="mt-2 text-xs text-slate-500 hover:text-slate-600"
          >
            Dismiss
          </button>
        </div>
      )}
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
