import { describe, it, expect } from "vitest";
import { isWithinQuota, countEventsSince, startOfMonthUTC } from "./usage.js";

describe("isWithinQuota — core allow/deny decision", () => {
  it("allows when usage is zero and the limit is positive", () => {
    expect(isWithinQuota(0, 20)).toBe(true);
  });

  it("allows when count is below the limit", () => {
    expect(isWithinQuota(19, 20)).toBe(true);
  });

  it("denies exactly at the limit (boundary case)", () => {
    expect(isWithinQuota(20, 20)).toBe(false);
  });

  it("denies when count exceeds the limit", () => {
    expect(isWithinQuota(21, 20)).toBe(false);
  });

  it("denies at the boundary for a limit of 0 (paranoia case, no free calls)", () => {
    expect(isWithinQuota(0, 0)).toBe(false);
  });

  it("always allows when no numeric limit is configured for the operation", () => {
    expect(isWithinQuota(9999, undefined)).toBe(true);
    expect(isWithinQuota(9999, null)).toBe(true);
  });
});

describe("countEventsSince — counting a set of usage_events by type and month", () => {
  const since = new Date("2026-08-01T00:00:00.000Z");

  it("returns 0 for an empty event list", () => {
    expect(countEventsSince([], "ai.improve_bullet", since)).toBe(0);
  });

  it("counts only matching event_type rows on/after the cutoff", () => {
    const events = [
      { event_type: "ai.improve_bullet", created_at: "2026-08-05T00:00:00.000Z" },
      { event_type: "ai.improve_bullet", created_at: "2026-08-20T00:00:00.000Z" },
      { event_type: "ai.improve_resume", created_at: "2026-08-10T00:00:00.000Z" }, // different type
      { event_type: "ai.improve_bullet", created_at: "2026-07-31T23:59:59.999Z" }, // before cutoff
    ];
    expect(countEventsSince(events, "ai.improve_bullet", since)).toBe(2);
  });

  it("treats the cutoff instant itself as included (>=)", () => {
    const events = [{ event_type: "ai.analyze_summary", created_at: since.toISOString() }];
    expect(countEventsSince(events, "ai.analyze_summary", since)).toBe(1);
  });

  it("combined with isWithinQuota: a plan limit of 5 with exactly 5 matching events this month denies the 6th call", () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      event_type: "ai.improve_resume",
      created_at: new Date(Date.UTC(2026, 7, 2 + i)).toISOString(),
    }));
    const count = countEventsSince(events, "ai.improve_resume", since);
    expect(count).toBe(5);
    expect(isWithinQuota(count, 5)).toBe(false);
  });

  it("combined with isWithinQuota: zero usage against any positive limit is always allowed", () => {
    const count = countEventsSince([], "ai.generate_cover_letter", since);
    expect(isWithinQuota(count, 10)).toBe(true);
  });
});

describe("startOfMonthUTC", () => {
  it("returns midnight UTC on the 1st of the given date's month", () => {
    const d = startOfMonthUTC(new Date("2026-08-25T13:45:00.000Z"));
    expect(d.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("handles December -> January year-boundary months correctly", () => {
    const d = startOfMonthUTC(new Date("2026-12-31T23:59:59.000Z"));
    expect(d.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
});
