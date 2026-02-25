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

/** Roles with status Applied+ that were added this calendar week. */
export function getApplicationsThisWeek(items: TrackerItem[]): number {
  const start = getStartOfWeek(new Date()).getTime();
  return items.filter(
    (i) =>
      (i.status === "Applied" ||
        i.status === "Interview" ||
        i.status === "Offer" ||
        i.status === "Rejected") &&
      new Date(i.createdAt).getTime() >= start
  ).length;
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
