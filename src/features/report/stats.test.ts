import { describe, it, expect } from "vitest";
import {
  getPeriodStats,
  getTopMissingSkill,
  getReportRecommendations,
  startOfPeriod,
} from "./stats";
import type { TrackerItem } from "../../types/tracker";
import type { CareerGoal } from "../../types/goals";

function makeItem(overrides: Partial<TrackerItem> = {}): TrackerItem {
  return {
    id: overrides.id ?? "item-1",
    company: overrides.company ?? "Acme Corp",
    role: overrides.role ?? "Software Engineer Intern",
    status: overrides.status ?? "Applied",
    alignment: overrides.alignment ?? 50,
    createdAt: overrides.createdAt ?? "2026-08-20T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-08-20T00:00:00.000Z",
    nextStep: overrides.nextStep ?? "",
    ...overrides,
  };
}

describe("startOfPeriod", () => {
  it("returns null for 'all' (no lower bound)", () => {
    expect(startOfPeriod("all")).toBeNull();
  });

  it("returns the Monday of the current week for 'week'", () => {
    // 2026-08-26 is a Wednesday
    const now = new Date("2026-08-26T15:00:00.000Z");
    const start = startOfPeriod("week", now);
    expect(start?.getDay()).toBe(1); // Monday
    expect(start!.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it("returns the 1st of the current month for 'month'", () => {
    const now = new Date("2026-08-26T15:00:00.000Z");
    const start = startOfPeriod("month", now);
    expect(start?.getDate()).toBe(1);
    expect(start?.getMonth()).toBe(7); // August (0-indexed)
  });
});

describe("getPeriodStats", () => {
  const now = new Date("2026-08-26T12:00:00.000Z"); // Wednesday

  it("returns all zeros for an empty tracker, with no fake response rate", () => {
    const stats = getPeriodStats([], "all", now);
    expect(stats.applications).toBe(0);
    expect(stats.interviews).toBe(0);
    expect(stats.offers).toBe(0);
    expect(stats.sampleTooSmall).toBe(true);
    expect(stats.responseRatePercent).toBeNull();
  });

  it("counts applications/interviews/offers by current status within the period", () => {
    const items = [
      makeItem({ id: "a", status: "Applied", createdAt: "2026-08-25T00:00:00.000Z" }),
      makeItem({ id: "b", status: "Interview", createdAt: "2026-08-24T12:00:00.000Z" }),
      makeItem({ id: "c", status: "Offer", createdAt: "2026-08-26T00:00:00.000Z" }),
      makeItem({ id: "d", status: "Wishlist", createdAt: "2026-08-26T00:00:00.000Z" }), // not applied yet
    ];
    const stats = getPeriodStats(items, "week", now);
    expect(stats.applications).toBe(3); // Applied, Interview, Offer all count as applied-plus
    expect(stats.interviews).toBe(2); // Interview + Offer
    expect(stats.offers).toBe(1);
  });

  it("excludes roles created before the period start", () => {
    const items = [
      makeItem({ id: "old", status: "Applied", createdAt: "2026-07-01T00:00:00.000Z" }),
      makeItem({ id: "new", status: "Applied", createdAt: "2026-08-25T00:00:00.000Z" }),
    ];
    const weekStats = getPeriodStats(items, "week", now);
    expect(weekStats.applications).toBe(1);
    const allStats = getPeriodStats(items, "all", now);
    expect(allStats.applications).toBe(2);
  });

  it("suppresses the response rate below MIN_SAMPLE_SIZE (no misleading small-sample rate)", () => {
    const items = [
      makeItem({ id: "a", status: "Interview" }),
      makeItem({ id: "b", status: "Applied" }),
    ];
    const stats = getPeriodStats(items, "all", now);
    expect(stats.applications).toBe(2);
    expect(stats.sampleTooSmall).toBe(true);
    expect(stats.responseRatePercent).toBeNull();
  });

  it("computes a real response rate once the sample is large enough", () => {
    const items = [
      makeItem({ id: "a", status: "Interview" }),
      makeItem({ id: "b", status: "Applied" }),
      makeItem({ id: "c", status: "Applied" }),
    ];
    const stats = getPeriodStats(items, "all", now);
    expect(stats.sampleTooSmall).toBe(false);
    expect(stats.responseRatePercent).toBe(33); // 1/3 rounded
  });
});

describe("getTopMissingSkill", () => {
  it("returns null when no roles have been analyzed", () => {
    expect(getTopMissingSkill([makeItem()])).toBeNull();
  });

  it("returns null when a skill is missing from only one role (not yet a pattern)", () => {
    const items = [
      makeItem({
        reportSnapshot: {
          alignment: 50,
          coverage: 50,
          skills: [{ name: "Docker", status: "miss", importance: "required" }],
          missingSignals: [],
          actions: [],
          alignmentHistory: [],
        },
      }),
    ];
    expect(getTopMissingSkill(items)).toBeNull();
  });

  it("returns the skill missing across the most roles once it recurs", () => {
    const snapWithDocker = {
      alignment: 50,
      coverage: 50,
      skills: [{ name: "Docker", status: "miss" as const, importance: "required" as const }],
      missingSignals: [],
      actions: [],
      alignmentHistory: [],
    };
    const items = [
      makeItem({ id: "a", reportSnapshot: snapWithDocker }),
      makeItem({ id: "b", reportSnapshot: snapWithDocker }),
      makeItem({
        id: "c",
        reportSnapshot: {
          ...snapWithDocker,
          skills: [{ name: "AWS", status: "miss", importance: "required" }],
        },
      }),
    ];
    const top = getTopMissingSkill(items);
    expect(top).toEqual({ skill: "Docker", count: 2 });
  });

  it("ignores skills that are hits or merely preferred (not required)", () => {
    const items = [
      makeItem({
        id: "a",
        reportSnapshot: {
          alignment: 50,
          coverage: 50,
          skills: [
            { name: "Python", status: "hit", importance: "required" },
            { name: "Kubernetes", status: "miss", importance: "preferred" },
          ],
          missingSignals: [],
          actions: [],
          alignmentHistory: [],
        },
      }),
      makeItem({
        id: "b",
        reportSnapshot: {
          alignment: 50,
          coverage: 50,
          skills: [{ name: "Kubernetes", status: "miss", importance: "preferred" }],
          missingSignals: [],
          actions: [],
          alignmentHistory: [],
        },
      }),
    ];
    expect(getTopMissingSkill(items)).toBeNull();
  });
});

describe("getReportRecommendations", () => {
  it("leads with a low-data notice when there are fewer than MIN_SAMPLE_SIZE applications", () => {
    const items = [makeItem({ status: "Applied" })];
    const recs = getReportRecommendations(items);
    expect(recs[0]).toMatch(/track a few more applications/i);
  });

  it("never returns more than 2 recommendations", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ id: `r${i}`, status: "Applied", deadline: "2020-01-01" }),
    );
    const recs = getReportRecommendations(items);
    expect(recs.length).toBeLessThanOrEqual(2);
  });

  it("surfaces goal progress when an active goal exists", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `r${i}`, status: "Applied", createdAt: "2026-08-01T00:00:00.000Z" }),
    );
    const goal: CareerGoal = {
      id: "g1",
      title: "Land a summer internship",
      applicationsTarget: 20,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    const recs = getReportRecommendations(items, [goal]);
    expect(recs.some((r) => r.includes("Land a summer internship"))).toBe(true);
  });

  it("always returns at least one recommendation, never an empty list", () => {
    const items = Array.from({ length: 5 }, (_, i) => makeItem({ id: `r${i}`, status: "Applied" }));
    const recs = getReportRecommendations(items);
    expect(recs.length).toBeGreaterThanOrEqual(1);
  });
});
