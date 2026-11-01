import { describe, it, expect } from "vitest";
import { createDailyBudget } from "./dailyBudget";

describe("createDailyBudget", () => {
  it("allows up to the cap and then refuses without going negative", () => {
    const b = createDailyBudget({ cap: 2 });
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(false);
    expect(b.tryConsume()).toBe(false);
    expect(b.remaining()).toBe(0);
  });

  it("starts fresh when the UTC day changes", () => {
    let t = new Date("2026-11-01T23:59:00Z");
    const b = createDailyBudget({ cap: 1, now: () => t });
    expect(b.tryConsume()).toBe(true);
    expect(b.tryConsume()).toBe(false);
    t = new Date("2026-11-02T00:01:00Z");
    expect(b.remaining()).toBe(1);
    expect(b.tryConsume()).toBe(true);
  });

  it("a cap of zero blocks everything", () => {
    const b = createDailyBudget({ cap: 0 });
    expect(b.tryConsume()).toBe(false);
  });
});
