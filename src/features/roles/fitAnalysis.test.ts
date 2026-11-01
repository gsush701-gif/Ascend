import { describe, expect, it } from "vitest";
import { getApplyVerdict, weakestPart } from "./fitAnalysis";

const skill = (name: string, status: "hit" | "miss", importance = "required") => ({ name, status, importance });
const breakdown = { requiredSkills: 40, technicalStack: 60, resumeEvidence: 20, ats: 90 };

describe("getApplyVerdict", () => {
  it("calls a high score with most required skills a strong fit", () => {
    const v = getApplyVerdict({
      alignment: 82,
      skills: [skill("A", "hit"), skill("B", "hit"), skill("C", "hit"), skill("D", "miss", "preferred")],
    });
    expect(v.level).toBe("strong");
    expect(v.reasons[0]).toBe("You match 3 of 3 required skills.");
  });

  it("does not call a high score strong when required skills are mostly missing", () => {
    const v = getApplyVerdict({
      alignment: 80,
      skills: [skill("A", "hit"), skill("B", "miss"), skill("C", "miss"), skill("D", "miss")],
    });
    expect(v.level).not.toBe("strong");
    expect(v.level).not.toBe("competitive");
    expect(v.level).toBe("stretch");
  });

  it("steps down through competitive, stretch and long shot by score", () => {
    const skills = [skill("A", "hit"), skill("B", "hit")];
    expect(getApplyVerdict({ alignment: 60, skills }).level).toBe("competitive");
    expect(getApplyVerdict({ alignment: 40, skills }).level).toBe("stretch");
    expect(getApplyVerdict({ alignment: 22, skills }).level).toBe("longshot");
  });

  it("does not let an empty required list block a good score", () => {
    expect(getApplyVerdict({ alignment: 78, skills: [skill("A", "hit", "preferred")] }).level).toBe("strong");
    expect(getApplyVerdict({ alignment: 78 }).level).toBe("strong");
  });

  it("explains the weakest part of the score, and only when it is actually weak", () => {
    const weak = getApplyVerdict({ alignment: 40, skills: [skill("A", "hit")], breakdown });
    expect(weak.reasons.join(" ")).toContain("resume evidence (20%)");
    const healthy = getApplyVerdict({
      alignment: 80,
      skills: [skill("A", "hit")],
      breakdown: { requiredSkills: 90, technicalStack: 80, resumeEvidence: 85, ats: 95 },
    });
    expect(healthy.reasons.join(" ")).not.toContain("Weakest area");
  });

  it("never states odds of an offer", () => {
    const text = JSON.stringify(getApplyVerdict({ alignment: 50, skills: [skill("A", "miss")], breakdown }));
    expect(text).not.toMatch(/chance|probab|likel|%\s*chance/i);
  });
});

describe("weakestPart", () => {
  it("finds the lowest component and copes with no breakdown", () => {
    expect(weakestPart(breakdown)).toEqual({ key: "resumeEvidence", value: 20 });
    expect(weakestPart(undefined)).toBeNull();
  });
});
