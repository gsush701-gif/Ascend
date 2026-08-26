import type { TrackerItem } from "../../types/tracker";
import type { CareerGoal } from "../../types/goals";
import {
  APPLIED_PLUS_STATUSES,
  INTERVIEW_PLUS_STATUSES,
  OFFER_PLUS_STATUSES,
  getApplicationsSentCount,
  getOverdueCount,
} from "../../lib/dashboardStats";
import { getApplicationsByCompany } from "../analytics/stats";
import { getGoalProgress } from "../goals/progress";

/** Minimum applications in a period before a response rate is shown as a real
 * rate rather than "not enough data yet" — matches the same threshold used
 * throughout Analytics (`MIN_SAMPLE_SIZE`) and Dashboard. */
export const MIN_SAMPLE_SIZE = 3;

export type ReportPeriod = "week" | "month" | "all";

/** Start of the given period (local time), or null for "all" (no lower bound). */
export function startOfPeriod(period: ReportPeriod, now: Date = new Date()): Date | null {
  if (period === "all") return null;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "week") {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    d.setDate(diff);
    return d;
  }
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export type PeriodStats = {
  period: ReportPeriod;
  periodLabel: string;
  /** Roles created in this period whose status has reached "Applied" or later. */
  applications: number;
  /** Of those roles created in this period, how many currently sit at Interview-or-later. */
  interviews: number;
  /** Of those roles created in this period, how many currently sit at Offer/Accepted. */
  offers: number;
  /** null when the sample is too small (< MIN_SAMPLE_SIZE applications) to be meaningful. */
  responseRatePercent: number | null;
  sampleTooSmall: boolean;
};

/**
 * Real, honest per-period stats computed purely from the user's own tracked
 * roles — bucketed by when each role was added to the tracker (`createdAt`),
 * the same convention `dashboardStats.ts`'s existing weekly helpers already
 * use, so this page's numbers stay consistent with Dashboard/Analytics
 * rather than introducing a second, subtly different methodology.
 *
 * Note this is a real limitation, not hidden: an interview reached this week
 * for a role added last month is NOT counted as "this week" here (there's no
 * per-event history in the data model, only current status + createdAt) —
 * it's counted under whichever period the role was originally added in.
 */
export function getPeriodStats(items: TrackerItem[], period: ReportPeriod, now: Date = new Date()): PeriodStats {
  const start = startOfPeriod(period, now);
  const scoped = start ? items.filter((i) => new Date(i.createdAt).getTime() >= start.getTime()) : items;

  const applications = scoped.filter((i) => APPLIED_PLUS_STATUSES.includes(i.status)).length;
  const interviews = scoped.filter((i) => INTERVIEW_PLUS_STATUSES.includes(i.status)).length;
  const offers = scoped.filter((i) => OFFER_PLUS_STATUSES.includes(i.status)).length;

  const sampleTooSmall = applications < MIN_SAMPLE_SIZE;
  const responseRatePercent = !sampleTooSmall ? Math.round((interviews / applications) * 100) : null;

  const periodLabel = period === "week" ? "This week" : period === "month" ? "This month" : "All time";

  return { period, periodLabel, applications, interviews, offers, responseRatePercent, sampleTooSmall };
}

export type TopMissingSkill = { skill: string; count: number };

/** The required skill most frequently missing across the user's analyzed
 * roles, or null if no skill recurs across at least 2 roles (a single
 * mention isn't a "pattern" worth calling out). */
export function getTopMissingSkill(items: TrackerItem[]): TopMissingSkill | null {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const skills = item.reportSnapshot?.skills ?? [];
    skills.forEach((s) => {
      if (s.status === "miss" && (s.importance ?? "required") === "required") {
        counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
      }
    });
  });
  let best: TopMissingSkill | null = null;
  for (const [skill, count] of counts) {
    if (!best || count > best.count) best = { skill, count };
  }
  return best && best.count >= 2 ? best : null;
}

/**
 * 1-2 concrete recommendations derived from real patterns in the user's own
 * data — never templated platitudes. Priority order: not-enough-data notice,
 * overdue deadlines, goal progress, a recurring missing skill, then the
 * company/category with the best interview rate. Falls back to a single
 * generic "keep applying" note only when literally nothing else applies.
 */
export function getReportRecommendations(items: TrackerItem[], goals: CareerGoal[] = []): string[] {
  const recs: string[] = [];
  const totalApplied = getApplicationsSentCount(items);

  if (totalApplied < MIN_SAMPLE_SIZE) {
    recs.push(
      "Track a few more applications to unlock a meaningful response rate and category breakdown here.",
    );
  }

  const overdue = getOverdueCount(items);
  if (overdue > 0 && recs.length < 2) {
    recs.push(
      `${overdue} deadline${overdue !== 1 ? "s are" : " is"} overdue — follow up or update status on ${
        overdue === 1 ? "it" : "them"
      } in Roles.`,
    );
  }

  if (recs.length < 2 && goals.length > 0) {
    const goal = goals[0];
    const progress = getGoalProgress(goal, items);
    const target = goal.applicationsTarget;
    if (typeof target === "number" && target > 0) {
      if (progress.applications < target) {
        recs.push(
          `You're at ${progress.applications}/${target} applications toward your goal "${goal.title}".`,
        );
      } else {
        recs.push(`You've hit your applications target for "${goal.title}" — consider setting a new goal.`);
      }
    }
  }

  if (recs.length < 2) {
    const topMissing = getTopMissingSkill(items);
    if (topMissing) {
      recs.push(
        `"${topMissing.skill}" is missing across ${topMissing.count} of your analyzed roles — get a learning path for it from the Analyzer.`,
      );
    }
  }

  if (recs.length < 2) {
    const byCompany = getApplicationsByCompany(items).filter((c) => c.interviewRate != null);
    if (byCompany.length > 0) {
      const best = [...byCompany].sort((a, b) => (b.interviewRate ?? 0) - (a.interviewRate ?? 0))[0];
      recs.push(
        `Your applications to ${best.company} have the best interview rate (${best.interviewRate}%) — look for similar roles.`,
      );
    }
  }

  if (recs.length === 0) {
    recs.push("Keep applying consistently — patterns will show up here as you track more roles.");
  }

  return recs.slice(0, 2);
}
