import { Pencil, Trash2 } from "lucide-react";
import { card } from "../../lib/ui";
import type { CareerGoal } from "../../types/goals";
import { getGoalProgress, getDaysUntilTarget, type GoalProgress } from "../../features/goals/progress";
import type { TrackerItem } from "../../types/tracker";

function ProgressRow({ label, current, target }: { label: string; current: number; target?: number }) {
  if (target == null) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">{label}</span>
        <span className="font-medium text-slate-900">{current}</span>
      </div>
    );
  }
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const met = current >= target;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">{label}</span>
        <span className={met ? "font-medium text-emerald-600" : "font-medium text-slate-900"}>
          {current} / {target}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-900/[0.06]">
        <div
          className={`h-full rounded-full ${met ? "bg-emerald-500" : "bg-cyan-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

type GoalCardProps = {
  goal: CareerGoal;
  items: TrackerItem[];
  onEdit: () => void;
  onDelete: () => void;
};

export function GoalCard({ goal, items, onEdit, onDelete }: GoalCardProps) {
  const progress: GoalProgress = getGoalProgress(goal, items);
  const daysUntil = getDaysUntilTarget(goal);

  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{goal.title}</h3>
          {goal.targetDate && (
            <p className="mt-0.5 text-xs text-slate-500">
              {daysUntil == null
                ? ""
                : daysUntil < 0
                ? `Target date passed ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? "s" : ""} ago`
                : daysUntil === 0
                ? "Target date is today"
                : `${daysUntil} day${daysUntil !== 1 ? "s" : ""} until target date`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-900/[0.06] hover:text-slate-700"
            aria-label="Edit goal"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-600"
            aria-label="Delete goal"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ProgressRow label="Applications" current={progress.applications} target={goal.applicationsTarget} />
        <ProgressRow label="Interviews" current={progress.interviews} target={goal.interviewsTarget} />
        <ProgressRow label="Offers" current={progress.offers} target={goal.offersTarget} />
      </div>
    </div>
  );
}
