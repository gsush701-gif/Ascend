import { describe, it, expect } from "vitest";
import { postedAgo } from "./format";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

describe("postedAgo", () => {
  it("reads naturally at each scale", () => {
    expect(postedAgo(ago(0), NOW)).toBe("today");
    expect(postedAgo(ago(1), NOW)).toBe("yesterday");
    expect(postedAgo(ago(5), NOW)).toBe("5 days ago");
    expect(postedAgo(ago(13), NOW)).toBe("13 days ago");
    expect(postedAgo(ago(14), NOW)).toBe("2 weeks ago");
    expect(postedAgo(ago(45), NOW)).toBe("6 weeks ago");
    expect(postedAgo(ago(90), NOW)).toBe("3 months ago");
  });

  it("returns null for a missing or invalid date, and never goes negative", () => {
    expect(postedAgo(undefined, NOW)).toBeNull();
    expect(postedAgo("not a date", NOW)).toBeNull();
    expect(postedAgo(new Date(NOW + 3 * 86_400_000).toISOString(), NOW)).toBe("today");
  });
});
