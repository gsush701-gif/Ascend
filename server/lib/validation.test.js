import { describe, it, expect } from "vitest";
import { isUuid } from "./validation.js";

describe("isUuid — request-body id validation for ownership-checked lookups", () => {
  it("accepts a well-formed lowercase UUID", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts a well-formed uppercase UUID", () => {
    expect(isUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("accepts a UUID with surrounding whitespace (trimmed before matching)", () => {
    expect(isUuid("  550e8400-e29b-41d4-a716-446655440000  ")).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isUuid("")).toBe(false);
  });

  it("rejects a UUID missing a segment", () => {
    expect(isUuid("550e8400-e29b-41d4-a716")).toBe(false);
  });

  it("rejects a SQL-injection-shaped string rather than throwing", () => {
    expect(isUuid("'; drop table roles; --")).toBe(false);
  });

  it("rejects non-string inputs (null, undefined, number, object) without throwing", () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(12345)).toBe(false);
    expect(isUuid({})).toBe(false);
    expect(isUuid(["550e8400-e29b-41d4-a716-446655440000"])).toBe(false);
  });
});
