import { describe, it, expect } from "vitest";
import {
  isAdminEmail,
  bucketCount,
  countDistinct,
  topByCount,
  computeEventTypeStats,
} from "./admin.js";

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
