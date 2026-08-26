import type { TrackerItem } from "../../types/tracker";
import type { CareerGoal } from "../../types/goals";
import {
  getApplicationsSentCount,
  getInterviewCount,
  getOfferCount,
} from "../../lib/dashboardStats";

export type GoalProgress = {
  applications: number;
  interviews: number;
  offers: number;
};

/**
 * Real progress for one goal, computed from the user's actual tracked roles
 * — never a fabricated/estimated number. Only counts roles created on or
 * after the goal itself was created, so an old backlog of applications from
 * before the goal existed doesn't inflate progress toward it. Reuses the
 * same pipeline status-grouping helpers dashboardStats.ts/Dashboard already
 * use (APPLIED_PLUS_STATUSES / INTERVIEW_PLUS_STATUSES / OFFER_PLUS_STATUSES
 * under the hood) rather than re-deriving the pipeline logic here.
 */
export function getGoalProgress(goal: CareerGoal, items: TrackerItem[]): GoalProgress {
  const since = new Date(goal.createdAt).getTime();
  const scoped = items.filter((i) => new Date(i.createdAt).getTime() >= since);
  return {
    applications: getApplicationsSentCount(scoped),
    interviews: getInterviewCount(scoped),
    offers: getOfferCount(scoped),
  };
}

/** Days remaining until a goal's target date; null if no target date set. Negative if overdue. */
export function getDaysUntilTarget(goal: CareerGoal): number | null {
  if (!goal.targetDate) return null;
  const target = new Date(goal.targetDate);
  if (Number.isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}
