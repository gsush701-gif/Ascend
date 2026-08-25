import type { TrackerItem, TrackerStatus } from "../types/tracker";

export type FunnelCounts = Record<TrackerStatus, number>;

export function getFunnelCounts(items: TrackerItem[]): FunnelCounts {
  const counts: FunnelCounts = {
    Wishlist: 0,
    Applied: 0,
    Interview: 0,
    Offer: 0,
    Rejected: 0,
  };
  items.forEach((item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  });
  return counts;
}

export type AlignmentPoint = { alignment: number; createdAt: string };

/** Collect alignment history from all tracker items' report snapshots, sorted by date ascending. */
export function getAlignmentHistoryFromTracker(
  items: TrackerItem[],
  maxPoints = 20
): AlignmentPoint[] {
  const points: AlignmentPoint[] = [];
  items.forEach((item) => {
    item.reportSnapshot?.alignmentHistory?.forEach((h) => {
      points.push({ alignment: h.alignment, createdAt: h.createdAt });
    });
    if (item.reportSnapshot && !item.reportSnapshot.alignmentHistory?.length) {
      points.push({
        alignment: item.alignment,
        createdAt: item.createdAt,
      });
    }
  });
  points.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  return points.slice(-maxPoints);
}

export function getAverageAlignment(items: TrackerItem[]): number | null {
  const withAlignment = items.filter((i) => i.alignment > 0 || i.reportSnapshot);
  if (withAlignment.length === 0) return null;
  const sum = withAlignment.reduce(
    (acc, i) => acc + (i.reportSnapshot?.alignment ?? i.alignment),
    0
  );
  return Math.round(sum / withAlignment.length);
}

export function getApplicationsSentCount(items: TrackerItem[]): number {
  return items.filter(
    (i) =>
      i.status === "Applied" ||
      i.status === "Interview" ||
      i.status === "Offer" ||
      i.status === "Rejected"
  ).length;
}

export function getInterviewCount(items: TrackerItem[]): number {
  return items.filter((i) => i.status === "Interview" || i.status === "Offer")
    .length;
}

/** Start of current week (Monday 00:00 local). */
function getStartOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Roles with status Applied+ that were added in the given week (by start-of-week timestamp). */
function countAppliedInWeek(items: TrackerItem[], weekStartMs: number, weekEndMs: number): number {
  return items.filter(
    (i) =>
      (i.status === "Applied" ||
        i.status === "Interview" ||
        i.status === "Offer" ||
        i.status === "Rejected") &&
      new Date(i.createdAt).getTime() >= weekStartMs &&
      new Date(i.createdAt).getTime() < weekEndMs
  ).length;
}

/** Unique dates (YYYY-MM-DD) when applications were added, sorted descending (most recent first). */
function getApplicationDates(items: TrackerItem[]): string[] {
  const applied = items.filter(
    (i) =>
      i.status === "Applied" ||
      i.status === "Interview" ||
      i.status === "Offer" ||
      i.status === "Rejected"
  );
  const dates = new Set<string>();
  applied.forEach((i) => {
    const d = new Date(i.createdAt);
    dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  });
  return [...dates].sort().reverse();
}

/** Consecutive days with at least one application, counting backwards from today. */
export function getApplicationStreak(items: TrackerItem[]): number {
  const dates = getApplicationDates(items);
  if (dates.length === 0) return 0;
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  let streak = 0;
  let checkDate = new Date(now);
  checkDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const dStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
    if (dates.includes(dStr)) {
      streak++;
      checkDate = new Date(checkDate.getTime() - oneDay);
    } else {
      break;
    }
  }
  return streak;
}

/** Days since last application (0 = today, 1 = yesterday). Null if no applications. */
export function getDaysSinceLastApplication(items: TrackerItem[]): number | null {
  const applied = items.filter(
    (i) =>
      i.status === "Applied" ||
      i.status === "Interview" ||
      i.status === "Offer" ||
      i.status === "Rejected"
  );
  if (applied.length === 0) return null;
  const latest = applied.reduce((max, i) =>
    new Date(i.createdAt).getTime() > new Date(max.createdAt).getTime()
      ? i
      : max
  );
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const last = new Date(latest.createdAt);
  last.setHours(0, 0, 0, 0);
  const diffMs = now.getTime() - last.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export type ApplicationsByWeekPoint = {
  weekLabel: string;
  applications: number;
};

/** Applications per week for chart (last 8 weeks, oldest first). */
export function getApplicationsByWeek(
  items: TrackerItem[],
  weeks = 8
): { weekLabel: string; applications: number }[] {
  const now = new Date();
  const result: { weekLabel: string; applications: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7 * i);
    const startMs = getStartOfWeek(d).getTime();
    const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
    const count = countAppliedInWeek(items, startMs, endMs);
    const label =
      i === 0 ? "This week" : i === 1 ? "Last week" : `${i}w ago`;
    result.push({ weekLabel: label, applications: count });
  }
  return result;
}

/** Applications (Applied+) added this calendar week. */
export function getApplicationsThisWeek(items: TrackerItem[]): number {
  const now = new Date();
  const start = getStartOfWeek(now).getTime();
  const next = new Date(start);
  next.setDate(next.getDate() + 7);
  return countAppliedInWeek(items, start, next.getTime());
}

/** Applications (Applied+) added last calendar week. */
export function getApplicationsLastWeek(items: TrackerItem[]): number {
  const now = new Date();
  const thisStart = getStartOfWeek(now).getTime();
  const lastStart = thisStart - 7 * 24 * 60 * 60 * 1000;
  return countAppliedInWeek(items, lastStart, thisStart);
}

/** Interview count / applications sent; null if no applications. */
export function getResponseRate(items: TrackerItem[]): number | null {
  const applied = getApplicationsSentCount(items);
  if (applied === 0) return null;
  const interviews = getInterviewCount(items);
  return Math.round((interviews / applied) * 100);
}

/** Alignment trend: last point vs first from recent history (e.g. "up", "down", "stable"). */
export function getAlignmentTrend(
  items: TrackerItem[],
  points = 5
): "up" | "down" | "stable" | null {
  const history = getAlignmentHistoryFromTracker(items, points);
  if (history.length < 2) return null;
  const first = history[0].alignment;
  const last = history[history.length - 1].alignment;
  const diff = last - first;
  if (diff > 2) return "up";
  if (diff < -2) return "down";
  return "stable";
}

/** Unique companies from tracker, most recent first. */
export function getRecentCompanies(items: TrackerItem[], max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const c = i.company?.trim();
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
      if (out.length >= max) break;
    }
  }
  return out;
}

/** Unique roles from tracker, most recent first. */
export function getRecentRoles(items: TrackerItem[], max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const r = i.role?.trim();
    if (r && !seen.has(r)) {
      seen.add(r);
      out.push(r);
      if (out.length >= max) break;
    }
  }
  return out;
}

export type UpcomingDeadline = {
  role: string;
  company: string;
  id: string;
  daysText: string;
  isOverdue: boolean;
};

/** Upcoming deadlines from tracker. Overdue first, then soonest. Max 5. */
export function getUpcomingDeadlines(
  items: TrackerItem[],
  max = 5
): UpcomingDeadline[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const withDays: { item: TrackerItem; diffDays: number }[] = [];
  for (const item of items) {
    const d = item.deadline?.trim();
    if (!d) continue;
    try {
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) continue;
      date.setHours(0, 0, 0, 0);
      const diffMs = date.getTime() - now.getTime();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      withDays.push({ item, diffDays });
    } catch {
      /* skip */
    }
  }
  withDays.sort((a, b) => a.diffDays - b.diffDays);
  return withDays.slice(0, max).map(({ item, diffDays }) => {
    let daysText: string;
    if (diffDays < 0) daysText = "Overdue";
    else if (diffDays === 0) daysText = "Today";
    else if (diffDays === 1) daysText = "1 day";
    else daysText = `${diffDays} days`;
    return {
      role: item.role,
      company: item.company,
      id: item.id,
      daysText,
      isOverdue: diffDays < 0,
    };
  });
}

/** Rejection rate: Rejected / apps sent. Null if no apps. */
export function getRejectionRate(items: TrackerItem[]): number | null {
  const applied = getApplicationsSentCount(items);
  if (applied === 0) return null;
  const rejected = items.filter((i) => i.status === "Rejected").length;
  return Math.round((rejected / applied) * 100);
}

/** Roles without reportSnapshot (need analysis). */
export function getRolesNeedingAnalysis(items: TrackerItem[]): number {
  return items.filter((i) => !i.reportSnapshot).length;
}

/** Roles with overdue deadlines. */
export function getOverdueCount(items: TrackerItem[]): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return items.filter((item) => {
    const d = item.deadline?.trim();
    if (!d) return false;
    try {
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return false;
      date.setHours(0, 0, 0, 0);
      return date.getTime() < now.getTime();
    } catch {
      return false;
    }
  }).length;
}

/** Roles with next step set (ready for follow-up), excluding "Apply today". */
export function getFollowUpReadyCount(items: TrackerItem[]): number {
  return items.filter(
    (i) => i.nextStep && i.nextStep.trim() !== "" && i.nextStep !== "Apply today"
  ).length;
}

export type ReadinessScores = {
  /** Average resume strength across saved snapshots. Null when there's no data yet — never a placeholder. */
  resume: number | null;
};

/**
 * Resume readiness, computed from real saved analysis snapshots (resumeStrengthAtSave).
 * Previously this also returned flat placeholder numbers for "projects", "deployments", and
 * "interview prep" (45 / 15 / 25 for every user, always) — there's no real signal behind those
 * in the data model, so they were cut rather than shown as fabricated stats.
 */
export function getReadinessScores(items: TrackerItem[]): ReadinessScores {
  const withSnap = items.filter((i) => i.reportSnapshot?.resumeStrengthAtSave != null);
  if (withSnap.length === 0) return { resume: null };
  const resume = Math.round(
    withSnap.reduce((a, i) => a + (i.reportSnapshot!.resumeStrengthAtSave ?? 0), 0) /
      withSnap.length
  );
  return { resume: Math.min(100, Math.max(0, resume)) };
}

const BENCHMARK_INTERVIEW_RATE = 30;

/** Short insight for Fit Score card from most recent analyzed role. */
export function getFitScoreInsight(items: TrackerItem[]): string | null {
  const withSnap = items.filter((i) => i.reportSnapshot);
  if (withSnap.length === 0) return null;
  const snap = withSnap[0].reportSnapshot!;
  const missing = snap.missingSignals ?? [];
  const skills = snap.skills ?? [];
  const missSkills = skills.filter((s) => s.status === "miss").map((s) => s.name);
  const combined = [...new Set([...missing, ...missSkills])];
  if (combined.length === 0) return null;
  if (combined.length <= 3) {
    return `Missing ${combined.length} core skill${combined.length !== 1 ? "s" : ""}: ${combined.slice(0, 3).join(", ")}.`;
  }
  return `Missing ${combined.length} core skills.`;
}

/** Performance sentence under Dashboard header. */
export function getPerformanceSentence(
  items: TrackerItem[],
  interviewRate: number | null,
  thisWeek: number,
  lastWeek: number
): string | null {
  const applied = getApplicationsSentCount(items);
  if (applied < 3) return null;
  if (interviewRate != null && interviewRate < BENCHMARK_INTERVIEW_RATE) {
    return "You're applying consistently but interview rate is below average.";
  }
  if (interviewRate != null && interviewRate >= BENCHMARK_INTERVIEW_RATE) {
    return "You're trending well. Keep focusing on high-fit roles.";
  }
  if (lastWeek > 0) {
    if (thisWeek > lastWeek) return "You're applying more this week. Strong momentum.";
    if (thisWeek < lastWeek) return "Apply to more roles this week to build pipeline.";
  }
  return null;
}

/** One-line insight for dashboard hero. Returns null if nothing meaningful. */
export function getTopInsight(
  items: TrackerItem[],
  interviewRate: number | null,
  avgAlignment: number | null,
  gapTo70: number | null
): string | null {
  const applied = getApplicationsSentCount(items);
  const thisWeek = getApplicationsThisWeek(items);
  const lastWeek = getApplicationsLastWeek(items);
  const needsAnalysis = getRolesNeedingAnalysis(items);
  const overdueCount = getOverdueCount(items);
  const followUpReady = getFollowUpReadyCount(items);

  if (overdueCount > 0) {
    return `${overdueCount} deadline${overdueCount !== 1 ? "s" : ""} overdue`;
  }
  if (followUpReady > 0 && applied > 3) {
    return `${followUpReady} role${followUpReady !== 1 ? "s" : ""} ready for follow-up. Stay on top of next steps.`;
  }
  if (needsAnalysis > 0 && applied > 0) {
    return `${needsAnalysis} role${needsAnalysis !== 1 ? "s" : ""} need analysis. Get fit scores to prioritize.`;
  }
  if (interviewRate != null && applied >= 5) {
    if (interviewRate < BENCHMARK_INTERVIEW_RATE) {
      return `Interview rate ${interviewRate}% (below avg ${BENCHMARK_INTERVIEW_RATE}%). Target roles with High fit to improve.`;
    }
    if (interviewRate >= BENCHMARK_INTERVIEW_RATE) {
      return `Interview rate ${interviewRate}%. You're above average. Keep targeting high-fit roles.`;
    }
  }
  if (gapTo70 != null && gapTo70 > 15 && avgAlignment != null) {
    return `Avg fit ${avgAlignment}%. Improve resume alignment to boost response rate.`;
  }
  if (lastWeek > 0) {
    if (thisWeek > lastWeek) {
      return `Applying more this week (${thisWeek} vs ${lastWeek} last week). Strong momentum.`;
    }
    if (thisWeek < lastWeek) {
      return `Apply to more roles this week to build pipeline (${thisWeek} vs ${lastWeek} last week).`;
    }
  }
  if (applied > 0 && applied < 3) {
    return "Add more applications to unlock response rate insights.";
  }
  return null;
}

export type FocusAction = {
  type: "overdue" | "deadline-soon" | "needs-analysis" | "stale" | "none";
  title: string;
  desc: string;
  roleId?: string;
};

/**
 * Single most useful next action, derived entirely from the user's own tracker data —
 * overdue deadlines, roles missing analysis, an upcoming deadline, or a stale application.
 * No fabricated priorities or cross-user comparisons.
 */
export function getFocusAction(items: TrackerItem[]): FocusAction {
  if (items.length === 0) {
    return {
      type: "none",
      title: "Add your first role",
      desc: "Track a role to unlock fit scoring, deadlines, and insights.",
    };
  }

  const nextDeadline = getUpcomingDeadlines(items, 1)[0];
  if (nextDeadline?.isOverdue) {
    return {
      type: "overdue",
      title: `${nextDeadline.role} at ${nextDeadline.company} is overdue`,
      desc: "This deadline has passed — update its status or follow up.",
      roleId: nextDeadline.id,
    };
  }

  const needsAnalysis = items.find((i) => !i.reportSnapshot);
  if (needsAnalysis) {
    return {
      type: "needs-analysis",
      title: `Analyze ${needsAnalysis.role} at ${needsAnalysis.company}`,
      desc: "No fit score yet — add a job description to see alignment and skill gaps.",
      roleId: needsAnalysis.id,
    };
  }

  if (nextDeadline) {
    return {
      type: "deadline-soon",
      title: `${nextDeadline.role} at ${nextDeadline.company} — due ${nextDeadline.daysText}`,
      desc: "Deadline coming up. Make sure your application is ready.",
      roleId: nextDeadline.id,
    };
  }

  const staleThresholdMs = 10 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const stale = [...items]
    .filter((i) => i.status === "Applied")
    .sort(
      (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    )[0];
  if (stale && now - new Date(stale.updatedAt).getTime() >= staleThresholdMs) {
    const days = Math.floor(
      (now - new Date(stale.updatedAt).getTime()) / (24 * 60 * 60 * 1000)
    );
    return {
      type: "stale",
      title: `Follow up on ${stale.role} at ${stale.company}`,
      desc: `No update in ${days} days — consider following up or changing its status.`,
      roleId: stale.id,
    };
  }

  return {
    type: "none",
    title: "You're on top of things",
    desc: "No urgent actions right now — keep applying to build your pipeline.",
  };
}

export type ActivityItem = {
  id: string;
  company: string;
  role: string;
  status: TrackerStatus;
  date: string;
  hasCoverLetter: boolean;
};

/** Most recently touched roles (added or updated), newest first — a real activity trail from tracker timestamps. */
export function getRecentActivity(items: TrackerItem[], max = 5): ActivityItem[] {
  return [...items]
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    )
    .slice(0, max)
    .map((i) => ({
      id: i.id,
      company: i.company,
      role: i.role,
      status: i.status,
      date: i.updatedAt || i.createdAt,
      hasCoverLetter: Boolean(i.coverLetter),
    }));
}

/** Human-friendly relative date ("Today", "Yesterday", "3 days ago", or a short date). */
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const diffDays = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Expected interviews range from applications sent and current response rate. */
export function getExpectedInterviewsRange(
  applicationsSent: number,
  responseRatePercent: number | null
): { low: number; high: number } {
  if (applicationsSent === 0) return { low: 0, high: 0 };
  const rate = (responseRatePercent ?? 10) / 100;
  const expected = applicationsSent * rate;
  const low = Math.max(0, Math.floor(expected * 0.7));
  const high = Math.ceil(expected * 1.3);
  return { low, high };
}
