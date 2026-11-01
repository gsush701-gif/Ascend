import { describe, expect, it } from "vitest";
import { groupSkills } from "./skillGroups";

describe("groupSkills", () => {
  it("splits missing skills by importance and keeps matched ones separate", () => {
    const g = groupSkills([
      { name: "Docker", status: "miss", importance: "required" },
      { name: "Kubernetes", status: "miss", importance: "preferred" },
      { name: "React", status: "hit", importance: "required" },
      { name: "Jest", status: "miss" }, // older reports have no importance: treated as required
    ]);
    expect(g.missingRequired).toEqual(["Docker", "Jest"]);
    expect(g.missingPreferred).toEqual(["Kubernetes"]);
    expect(g.matched).toEqual(["React"]);
  });

  it("copes with no data", () => {
    expect(groupSkills(undefined)).toEqual({ missingRequired: [], missingPreferred: [], matched: [] });
    expect(groupSkills([])).toEqual({ missingRequired: [], missingPreferred: [], matched: [] });
  });
});
