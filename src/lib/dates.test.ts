import { describe, expect, it } from "vitest";
import { deadlineInputValue, parseDeadline } from "./dates";

describe("parseDeadline", () => {
  it("reads a plain date as local midnight, not UTC", () => {
    const d = parseDeadline("2026-11-10");
    expect(d).not.toBeNull();
    expect([d!.getFullYear(), d!.getMonth(), d!.getDate(), d!.getHours()]).toEqual([2026, 10, 10, 0]);
  });

  it("still reads other date text", () => {
    expect(parseDeadline("Nov 10, 2026")?.getDate()).toBe(10);
  });

  it("returns null for empty or non-date text", () => {
    expect(parseDeadline("")).toBeNull();
    expect(parseDeadline("   ")).toBeNull();
    expect(parseDeadline(undefined)).toBeNull();
    expect(parseDeadline("soon")).toBeNull();
  });
});

describe("deadlineInputValue", () => {
  it("round-trips a date input value unchanged", () => {
    expect(deadlineInputValue("2026-11-10")).toBe("2026-11-10");
    expect(deadlineInputValue("2026-01-02")).toBe("2026-01-02");
  });

  it("is empty when there is no valid deadline", () => {
    expect(deadlineInputValue(undefined)).toBe("");
    expect(deadlineInputValue("soon")).toBe("");
  });
});
