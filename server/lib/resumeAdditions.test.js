import { describe, expect, it } from "vitest";
import { parseAdditions, applyAdditions, MAX_ADDITION_LINES, MAX_LINE_LENGTH } from "./resumeAdditions.js";

describe("parseAdditions", () => {
  it("splits lines, strips bullet markers, and drops blanks and very short lines", () => {
    const raw = "- Built a REST API with Express\n• Wrote Jest tests for the API\n\n  \nok\n* Deployed the app to Render";
    expect(parseAdditions(raw)).toEqual([
      "Built a REST API with Express",
      "Wrote Jest tests for the API",
      "Deployed the app to Render",
    ]);
  });

  it("caps the number of lines and the length of each", () => {
    const many = Array.from({ length: 40 }, (_, i) => `Line number ${i} describing real work`).join("\n");
    expect(parseAdditions(many)).toHaveLength(MAX_ADDITION_LINES);
    expect(parseAdditions("x".repeat(1000))[0]).toHaveLength(MAX_LINE_LENGTH);
  });

  it("returns [] for anything that is not a string", () => {
    expect(parseAdditions(undefined)).toEqual([]);
    expect(parseAdditions(["a"])).toEqual([]);
    expect(parseAdditions(42)).toEqual([]);
  });
});

describe("applyAdditions", () => {
  it("returns the resume unchanged when there is nothing to add", () => {
    expect(applyAdditions("resume text", [])).toBe("resume text");
  });

  it("appends the lines as bullets after the resume text", () => {
    expect(applyAdditions("resume text", ["Built an API"])).toBe("resume text\n• Built an API");
  });
});
