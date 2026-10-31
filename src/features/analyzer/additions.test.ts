import { describe, expect, it } from "vitest";
import { additionsToText, MIN_ADDITION_LENGTH, starterFor, upsertAddition, validateAddition } from "./additions";

describe("validateAddition", () => {
  it("accepts a real bullet that mentions the skill", () => {
    expect(validateAddition("Docker", "Containerised the API with Docker and deployed it to Render")).toBeNull();
  });

  it("matches the skill case-insensitively", () => {
    expect(validateAddition("React", "Built the dashboard in react with hooks and context")).toBeNull();
  });

  it("rejects short text, a missing skill mention, and the bare starter", () => {
    expect(validateAddition("Docker", "Used Docker")).toMatch(/full bullet/i);
    expect(validateAddition("Docker", "Deployed the whole thing to a cloud server for the class")).toMatch(/Mention Docker/);
    expect(validateAddition("Docker", starterFor("Docker"))).not.toBeNull();
    expect(starterFor("Docker").length).toBeLessThan(MIN_ADDITION_LENGTH);
  });

  it("rejects leftover template placeholders", () => {
    expect(validateAddition("Jest", "Added Jest tests; coverage [X]%, caught [N] regressions")).toMatch(/placeholder/i);
    expect(validateAddition("Jest", "Wrote Jest tests and cut regressions by XX percent")).toMatch(/placeholder/i);
  });
});

describe("upsertAddition / additionsToText", () => {
  it("keeps one bullet per skill, replacing the earlier one", () => {
    let list = upsertAddition([], { skill: "Docker", text: "First version using Docker for the API" });
    list = upsertAddition(list, { skill: "docker", text: "  Second version using Docker with compose  " });
    expect(list).toEqual([{ skill: "docker", text: "Second version using Docker with compose" }]);
  });

  it("renders bullets as plain text lines", () => {
    const list = [
      { skill: "A", text: "Did a thing with A" },
      { skill: "B", text: "Did a thing with B" },
    ];
    expect(additionsToText(list)).toBe("• Did a thing with A\n• Did a thing with B");
    expect(additionsToText([])).toBe("");
  });
});
