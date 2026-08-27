import { describe, it, expect } from "vitest";
import { moveArrayItem, removeArrayItem, updateArrayItem } from "./arrayHelpers";

describe("moveArrayItem", () => {
  it("moves an item up", () => {
    expect(moveArrayItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
  });

  it("moves an item down", () => {
    expect(moveArrayItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
  });

  it("is a no-op (but returns a fresh array) when moving the first item up", () => {
    const input = ["a", "b", "c"];
    const result = moveArrayItem(input, 0, -1);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it("is a no-op (but returns a fresh array) when moving the last item down", () => {
    const input = ["a", "b", "c"];
    const result = moveArrayItem(input, 2, 1);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it("is a no-op for an out-of-range index", () => {
    expect(moveArrayItem(["a", "b"], 5, -1)).toEqual(["a", "b"]);
    expect(moveArrayItem(["a", "b"], -1, 1)).toEqual(["a", "b"]);
  });

  it("does not mutate the original array", () => {
    const input = ["a", "b", "c"];
    moveArrayItem(input, 0, 1);
    expect(input).toEqual(["a", "b", "c"]);
  });

  it("works on a single-item array (both directions are no-ops)", () => {
    expect(moveArrayItem(["only"], 0, -1)).toEqual(["only"]);
    expect(moveArrayItem(["only"], 0, 1)).toEqual(["only"]);
  });
});

describe("removeArrayItem", () => {
  it("removes the item at the given index", () => {
    expect(removeArrayItem(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  it("removing the only item yields an empty array", () => {
    expect(removeArrayItem(["a"], 0)).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const input = ["a", "b", "c"];
    removeArrayItem(input, 0);
    expect(input).toEqual(["a", "b", "c"]);
  });
});

describe("updateArrayItem", () => {
  it("replaces the item at the given index", () => {
    expect(updateArrayItem(["a", "b", "c"], 1, "B")).toEqual(["a", "B", "c"]);
  });

  it("leaves other items untouched", () => {
    const objs = [{ n: 1 }, { n: 2 }];
    const result = updateArrayItem(objs, 0, { n: 99 });
    expect(result[1]).toBe(objs[1]);
  });

  it("does not mutate the original array", () => {
    const input = ["a", "b"];
    updateArrayItem(input, 0, "Z");
    expect(input).toEqual(["a", "b"]);
  });
});
