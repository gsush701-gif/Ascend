import { describe, it, expect } from "vitest";
import {
  isAdminEmail,
  bucketCount,
  countDistinct,
  topByCount,
  computeEventTypeStats,
  computeFunnel,
  computeTryStats,
} from "./admin.js";

describe("computeTryStats — the logged-out /try page", () => {
  it("counts distinct visitors by vid and splits example from own-resume runs", () => {
    const stats = computeTryStats([
      { event_type: "try_viewed", metadata: { vid: "a" } },
      { event_type: "try_viewed", metadata: { vid: "a" } },
      { event_type: "try_viewed", metadata: { vid: "b" } },
      { event_type: "try_analysis_completed", metadata: { vid: "a", example: true } },
      { event_type: "try_analysis_completed", metadata: { vid: "b", example: false } },
      { event_type: "try_signup_clicked", metadata: { vid: "b" } },
      { event_type: "analysis_completed", metadata: { vid: "z" } },
    ]);
    expect(stats).toEqual({
      visitors: 2,
      pageViews: 3,
      analyses: 2,
      analysesVisitors: 2,
      analysesOnExample: 1,
      analysesOnOwn: 1,
      signupClicks: 1,
      signupClickVisitors: 1,
    });
  });

  it("copes with missing metadata and empty input", () => {
    expect(computeTryStats([{ event_type: "try_viewed", metadata: null }]).visitors).toBe(0);
    expect(computeTryStats([{ event_type: "try_viewed", metadata: null }]).pageViews).toBe(1);
    expect(computeTryStats(undefined).pageViews).toBe(0);
  });
});

describe("isAdminEmail — the real server-side admin boundary", () => {
  it("allows an exact match", () => {
    expect(isAdminEmail("owner@example.com", "owner@example.com")).toBe(true);
  });

  it("is case-insensitive on both sides", () => {
    expect(isAdminEmail("Owner@Example.com", "owner@example.com")).toBe(true);
    expect(isAdminEmail("owner@example.com", "OWNER@EXAMPLE.COM")).toBe(true);
  });

  it("matches one entry in a comma-separated list, trimming whitespace", () => {
    expect(isAdminEmail("b@example.com", "a@example.com, b@example.com , c@example.com")).toBe(true);
  });

  it("denies an email not in the list", () => {
    expect(isAdminEmail("attacker@example.com", "owner@example.com")).toBe(false);
  });

  it("denies when ADMIN_EMAILS is unset/empty (fail closed)", () => {
    expect(isAdminEmail("owner@example.com", undefined)).toBe(false);
    expect(isAdminEmail("owner@example.com", "")).toBe(false);
  });

  it("denies when there is no email at all", () => {
    expect(isAdminEmail(null, "owner@example.com")).toBe(false);
    expect(isAdminEmail(undefined, "owner@example.com")).toBe(false);
    expect(isAdminEmail("", "owner@example.com")).toBe(false);
  });

  it("never does a loose/substring match", () => {
    expect(isAdminEmail("owner@example.com.evil.com", "owner@example.com")).toBe(false);
    expect(isAdminEmail("notowner@example.com", "owner@example.com")).toBe(false);
  });
});

describe("bucketCount", () => {
  it("counts occurrences of each distinct value", () => {
    expect(bucketCount(["Applied", "Applied", "Wishlist"])).toEqual({ Applied: 2, Wishlist: 1 });
  });

  it("groups null/undefined/empty-string under 'unknown' rather than dropping them", () => {
    expect(bucketCount(["active", null, undefined, ""])).toEqual({ active: 1, unknown: 3 });
  });

  it("returns an empty object for an empty/missing input", () => {
    expect(bucketCount([])).toEqual({});
    expect(bucketCount(undefined)).toEqual({});
  });
});

describe("countDistinct", () => {
  it("counts distinct non-null values", () => {
    expect(countDistinct(["u1", "u2", "u1", "u3"])).toBe(3);
  });

  it("ignores null/undefined", () => {
    expect(countDistinct(["u1", null, undefined, "u1"])).toBe(1);
  });

  it("returns 0 for empty input", () => {
    expect(countDistinct([])).toBe(0);
  });
});

describe("topByCount", () => {
  it("ranks by descending count and caps at topN", () => {
    const values = ["u1", "u2", "u1", "u3", "u1", "u2"];
    expect(topByCount(values, 2)).toEqual([
      { key: "u1", count: 3 },
      { key: "u2", count: 2 },
    ]);
  });

  it("ignores null/undefined entries", () => {
    expect(topByCount(["u1", null, undefined, "u1"], 5)).toEqual([{ key: "u1", count: 2 }]);
  });

  it("returns an empty array for empty input", () => {
    expect(topByCount([], 5)).toEqual([]);
  });
});

describe("computeEventTypeStats", () => {
  it("counts requests per event type", () => {
    const rows = [
      { event_type: "ai.improve_bullet", metadata: { success: true } },
      { event_type: "ai.improve_bullet", metadata: { success: true } },
      { event_type: "ai.ats_check", metadata: { success: true } },
    ];
    const stats = computeEventTypeStats(rows);
    expect(stats["ai.improve_bullet"].requestCount).toBe(2);
    expect(stats["ai.ats_check"].requestCount).toBe(1);
  });

  it("computes a real error rate when success/failure is tracked", () => {
    const rows = [
      { event_type: "ai.improve_bullet", metadata: { success: true } },
      { event_type: "ai.improve_bullet", metadata: { success: true } },
      { event_type: "ai.improve_bullet", metadata: { success: false } },
    ];
    const stats = computeEventTypeStats(rows);
    expect(stats["ai.improve_bullet"].successCount).toBe(2);
    expect(stats["ai.improve_bullet"].failureCount).toBe(1);
    expect(stats["ai.improve_bullet"].errorRatePct).toBeCloseTo(33.3, 1);
  });

  it("reports errorRatePct as null (not 0) when no row ever tracked success/failure", () => {
    // Mirrors a hypothetical event type recorded with no metadata at all —
    // "unknown", not "zero errors".
    const rows = [{ event_type: "signup", metadata: null }];
    const stats = computeEventTypeStats(rows);
    expect(stats.signup.errorRatePct).toBeNull();
  });

  it("ignores malformed rows without throwing", () => {
    expect(() => computeEventTypeStats([null, {}, { event_type: 42 }])).not.toThrow();
    expect(computeEventTypeStats([null, {}, { event_type: 42 }])).toEqual({});
  });
});

describe("computeEventTypeStats — token cost", () => {
  it("sums tokens/cost and averages over rows that recorded cost", () => {
    const rows = [
      { event_type: "ai.analyze_summary", metadata: { success: true, totalTokens: 1000, estCostUsd: 0.0004 } },
      { event_type: "ai.analyze_summary", metadata: { success: true, totalTokens: 3000, estCostUsd: 0.0012 } },
      // Recorded before cost tracking existed — counted as a request, not as cost.
      { event_type: "ai.analyze_summary", metadata: { success: true } },
    ];
    const s = computeEventTypeStats(rows)["ai.analyze_summary"];
    expect(s.requestCount).toBe(3);
    expect(s.costTrackedCount).toBe(2);
    expect(s.totalTokens).toBe(4000);
    expect(s.estCostUsd).toBeCloseTo(0.0016, 6);
    expect(s.avgCostUsd).toBeCloseTo(0.0008, 6);
  });

  it("reports cost as null (not 0) when no row recorded any", () => {
    const s = computeEventTypeStats([{ event_type: "ai.ats_check", metadata: { success: true } }])["ai.ats_check"];
    expect(s.estCostUsd).toBeNull();
    expect(s.avgCostUsd).toBeNull();
    expect(s.totalTokens).toBeNull();
  });
});

describe("computeFunnel — signup activation", () => {
  const ev = (user_id, event_type) => ({ user_id, event_type });

  it("counts distinct users per step as a share of the signup cohort", () => {
    const rows = [
      ev("a", "analysis_completed"),
      ev("a", "analysis_completed"), // repeat by the same user counts once
      ev("b", "analysis_completed"),
      ev("a", "role_created"),
      ev("c", "resume_uploaded"),
    ];
    const f = computeFunnel(["a", "b", "c", "d"], rows);
    const step = (k) => f.steps.find((s) => s.key === k);
    expect(f.signups).toBe(4);
    expect(step("analysis_completed")).toMatchObject({ users: 2, pctOfSignups: 50 });
    expect(step("role_created")).toMatchObject({ users: 1, pctOfSignups: 25 });
    expect(step("cover_letter_generated").users).toBe(0);
  });

  it("defines activated as analysis AND a role, and counts signups who did nothing", () => {
    const rows = [ev("a", "analysis_completed"), ev("a", "role_created"), ev("b", "analysis_completed")];
    const f = computeFunnel(["a", "b", "c"], rows);
    expect(f.activated.users).toBe(1);
    expect(f.didNothing.users).toBe(1);
    expect(f.didNothing.pctOfSignups).toBeCloseTo(33.3, 1);
  });

  it("ignores anonymous events, other event types, and users outside the cohort", () => {
    const rows = [ev(null, "role_created"), ev("x", "role_created"), ev("a", "signup"), ev("a", "ai.improve_bullet")];
    const f = computeFunnel(["a"], rows);
    expect(f.steps.every((s) => s.users === 0)).toBe(true);
    expect(f.didNothing.users).toBe(1);
  });

  it("reports null percentages for an empty cohort rather than dividing by zero", () => {
    const f = computeFunnel([], []);
    expect(f.signups).toBe(0);
    expect(f.activated.pctOfSignups).toBeNull();
    expect(f.steps[0].pctOfSignups).toBeNull();
  });
});
