import { describe, it, expect } from "vitest";
import { createKeyedTtlCache } from "./ttlCache.js";

describe("createKeyedTtlCache", () => {
  it("returns a stored value until it expires", () => {
    let t = 0;
    const c = createKeyedTtlCache({ ttlMs: 1000, now: () => t });
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    t = 999;
    expect(c.get("a")).toBe(1);
    t = 1000;
    expect(c.get("a")).toBeUndefined();
    expect(c.size()).toBe(0);
  });

  it("returns undefined for an unknown key and keeps keys apart", () => {
    const c = createKeyedTtlCache();
    c.set("a", 1);
    c.set("b", 2);
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBe(2);
    expect(c.get("nope")).toBeUndefined();
  });

  it("drops the oldest entry when full, and does not grow when a key is replaced", () => {
    const c = createKeyedTtlCache({ max: 2 });
    c.set("a", 1);
    c.set("b", 2);
    c.set("b", 22); // replacing does not evict
    expect(c.size()).toBe(2);
    c.set("c", 3); // full: the oldest ("a") goes
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(22);
    expect(c.get("c")).toBe(3);
  });

  it("forgets everything when cleared", () => {
    const c = createKeyedTtlCache();
    c.set("a", 1);
    c.clear();
    expect(c.get("a")).toBeUndefined();
  });
});
