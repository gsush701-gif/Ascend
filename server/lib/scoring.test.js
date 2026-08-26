import { describe, it, expect } from "vitest";
import {
  extractSkills,
  classifySkillsImportance,
  computeScoreBreakdown,
  missingSignals,
  extractSalary,
} from "./scoring.js";

describe("extractSkills — word-boundary matching (Task 1)", () => {
  it("does NOT match 'java' inside 'javascript'", () => {
    const hits = extractSkills("I have strong JavaScript experience.");
    expect(hits).toContain("javascript");
    expect(hits).not.toContain("java");
  });

  it("does NOT match 'git' inside 'digital'", () => {
    const hits = extractSkills("Worked on digital marketing campaigns.");
    expect(hits).not.toContain("git");
  });

  it("does NOT match 'api' inside 'capital' or 'rapid'", () => {
    const hits = extractSkills("We raised capital rapidly for the company.");
    expect(hits).not.toContain("rest api");
  });

  it("still matches a standalone mention of 'Java'", () => {
    const hits = extractSkills("3 years of professional Java development.");
    expect(hits).toContain("java");
  });

  it("still matches a standalone mention of 'Git'", () => {
    const hits = extractSkills("Daily use of Git for version control.");
    expect(hits).toContain("git");
  });

  it("still matches a standalone mention of 'API'", () => {
    const hits = extractSkills("Consumed a third-party API for pricing data.");
    expect(hits).toContain("rest api");
  });

  it("still matches the multi-word phrase 'REST API'", () => {
    const hits = extractSkills("Built a REST API for the checkout service.");
    expect(hits).toContain("rest api");
  });

  it("handles regex-special-character skill names like c++ and c#", () => {
    expect(extractSkills("5 years of C++ experience.")).toContain("c++");
    expect(extractSkills("Wrote services in C# and .NET.")).toContain("c#");
    // and they don't accidentally swallow unrelated text around them
    expect(extractSkills("A cat sat on a mat.")).not.toContain("c++");
  });

  it("does not match a skill embedded inside a longer unrelated word in the resume text either (not just the JD)", () => {
    const hits = extractSkills("Managed a digital transformation initiative with capital budgeting.");
    expect(hits).not.toContain("git");
    expect(hits).not.toContain("rest api");
  });

  it("is case-insensitive and normalizes whitespace", () => {
    expect(extractSkills("PYTHON   and   SQL")).toEqual(
      expect.arrayContaining(["python", "sql"]),
    );
  });
});

describe("classifySkillsImportance — required vs preferred (Task 2)", () => {
  it("classifies a skill near 'must have' / 'required' language as required", () => {
    const jd = "Requirements: must have strong Python skills for this role.";
    const result = classifySkillsImportance(jd, ["python"]);
    expect(result.python).toBe("required");
  });

  it("classifies a skill near 'minimum qualifications' as required", () => {
    const jd = "Minimum qualifications: SQL experience is required for all candidates.";
    const result = classifySkillsImportance(jd, ["sql"]);
    expect(result.sql).toBe("required");
  });

  it("classifies a skill near 'preferred' / 'nice to have' language as preferred", () => {
    const jd = "Preferred qualifications: familiarity with Docker is a plus.";
    const result = classifySkillsImportance(jd, ["docker"]);
    expect(result.docker).toBe("preferred");
  });

  it("classifies a skill near 'bonus' / 'nice-to-have' as preferred", () => {
    const jd = "Nice-to-have: experience with Kubernetes is a bonus.";
    const result = classifySkillsImportance(jd, ["kubernetes"]);
    expect(result.kubernetes).toBe("preferred");
  });

  it("defaults to required when no signal language is nearby (silence = required)", () => {
    const jd = "We are looking for someone with Python and SQL. Team of 5 engineers.";
    const result = classifySkillsImportance(jd, ["python", "sql"]);
    expect(result.python).toBe("required");
    expect(result.sql).toBe("required");
  });

  it("classifies each skill independently in a JD with both sections", () => {
    const jd =
      "Requirements:\n" +
      "- Must have strong Python and SQL experience.\n" +
      "- AWS experience is required.\n\n" +
      "Preferred qualifications:\n" +
      "- Familiarity with Docker is a big plus.\n";
    const result = classifySkillsImportance(jd, ["python", "sql", "docker", "aws"]);
    expect(result.python).toBe("required");
    expect(result.sql).toBe("required");
    expect(result.docker).toBe("preferred");
    expect(result.aws).toBe("required");
  });

  it("picks the closer signal phrase when both required and preferred language appear in the JD", () => {
    const jd =
      "Preferred qualifications section far above. ".repeat(10) +
      "Must have React experience. " +
      "Nice to have section far below. ".repeat(10);
    const result = classifySkillsImportance(jd, ["react"]);
    expect(result.react).toBe("required");
  });
});

describe("computeScoreBreakdown — explainable score (Task 3)", () => {
  const baseSignals = () => missingSignals("");

  it("produces bounded 0-100 values for every component and the overall score", () => {
    const skills = [
      { name: "python", status: "hit", importance: "required" },
      { name: "sql", status: "miss", importance: "required" },
      { name: "docker", status: "hit", importance: "preferred" },
    ];
    const resumeText = "Experience: built things. Skills: Python.";
    const { overallScore, breakdown } = computeScoreBreakdown({
      skills,
      resumeText,
      numPages: 1,
      signals: baseSignals(),
    });

    for (const value of [overallScore, breakdown.requiredSkills, breakdown.technicalStack, breakdown.resumeEvidence, breakdown.ats]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("gives a perfect requiredSkills score when every required skill is hit", () => {
    const skills = [
      { name: "python", status: "hit", importance: "required" },
      { name: "sql", status: "hit", importance: "required" },
      { name: "docker", status: "miss", importance: "preferred" },
    ];
    const { breakdown } = computeScoreBreakdown({
      skills,
      resumeText: "some resume text",
      numPages: 1,
      signals: [],
    });
    expect(breakdown.requiredSkills).toBe(100);
    // technicalStack blends in the missed preferred skill, so it should be lower
    expect(breakdown.technicalStack).toBeLessThan(breakdown.requiredSkills);
  });

  it("falls back to the overall stack ratio when there are no required-classified skills", () => {
    const skills = [
      { name: "docker", status: "hit", importance: "preferred" },
      { name: "kubernetes", status: "miss", importance: "preferred" },
    ];
    const { breakdown } = computeScoreBreakdown({
      skills,
      resumeText: "some resume text",
      numPages: 1,
      signals: [],
    });
    expect(breakdown.requiredSkills).toBe(breakdown.technicalStack);
  });

  it("increases resumeEvidence as more real resume-quality signals are present", () => {
    const skills = [{ name: "python", status: "hit", importance: "required" }];
    const worse = computeScoreBreakdown({
      skills,
      resumeText: "no signals here",
      numPages: 1,
      signals: ["No deployment/hosting experience mentioned", "No quantified impact (numbers/metrics) found", "No GitHub link/mention detected"],
    });
    const better = computeScoreBreakdown({
      skills,
      resumeText: "no signals here",
      numPages: 1,
      signals: [],
    });
    expect(better.breakdown.resumeEvidence).toBeGreaterThan(worse.breakdown.resumeEvidence);
    expect(worse.breakdown.resumeEvidence).toBe(0);
    expect(better.breakdown.resumeEvidence).toBe(100);
  });

  it("does not crash and stays bounded on an empty report (no skills, no resume text)", () => {
    const { overallScore, breakdown } = computeScoreBreakdown({
      skills: [],
      resumeText: "",
      numPages: 1,
      signals: ["a", "b", "c"],
    });
    expect(overallScore).toBeGreaterThanOrEqual(0);
    expect(overallScore).toBeLessThanOrEqual(100);
    expect(breakdown.requiredSkills).toBe(0);
    expect(breakdown.technicalStack).toBe(0);
  });
});

describe("extractSalary — regex salary detection (Task 4)", () => {
  it("returns null when no salary is mentioned at all", () => {
    expect(extractSalary("We are looking for a Software Engineer with Python experience.")).toBeNull();
  });

  it("returns null for empty/missing text", () => {
    expect(extractSalary("")).toBeNull();
    expect(extractSalary(undefined)).toBeNull();
    expect(extractSalary(null)).toBeNull();
  });

  it("does not hallucinate a number from an unrelated dollar mention", () => {
    expect(extractSalary("We just raised $5,000,000 in Series A funding.")).toBeNull();
    expect(extractSalary("Company benefits include a $500 wellness stipend.")).toBeNull();
  });

  it("parses a simple hourly range with /hour suffix", () => {
    const result = extractSalary("Pay range: $18-$25/hour depending on experience.");
    expect(result).toMatchObject({ min: 18, max: 25, currency: "USD", period: "hourly" });
    expect(result.estimatedAnnual).toBeDefined();
    expect(result.estimatedAnnual.min).toBe(18 * 2080);
    expect(result.estimatedAnnual.max).toBe(25 * 2080);
    expect(result.estimatedAnnual.note.toLowerCase()).toContain("estimate");
  });

  it("parses an hourly range phrased as 'per hour'", () => {
    const result = extractSalary("Compensation: $20 to $30 per hour.");
    expect(result).toMatchObject({ min: 20, max: 30, period: "hourly" });
  });

  it("parses an hourly range phrased as 'an hour'", () => {
    const result = extractSalary("This role pays $22-$28 an hour.");
    expect(result).toMatchObject({ min: 22, max: 28, period: "hourly" });
  });

  it("parses a $XXk-$YYk annual range", () => {
    const result = extractSalary("Salary: $80k-$110k depending on level.");
    expect(result).toMatchObject({ min: 80000, max: 110000, currency: "USD", period: "annual" });
    expect(result.estimatedAnnual).toBeUndefined();
  });

  it("parses a $XXK - $YYK annual range with spaces and uppercase K", () => {
    const result = extractSalary("We offer $90K - $130K annually.");
    expect(result).toMatchObject({ min: 90000, max: 130000, period: "annual" });
  });

  it("parses a comma-grouped annual range with an explicit 'per year' keyword", () => {
    const result = extractSalary("Base salary of $70,000 - $90,000 per year.");
    expect(result).toMatchObject({ min: 70000, max: 90000, period: "annual" });
  });

  it("parses a bare comma-grouped annual range with no period keyword", () => {
    const result = extractSalary("Compensation: $85,000 - $105,000.");
    expect(result).toMatchObject({ min: 85000, max: 105000, period: "annual" });
  });

  it("handles 'to' as a range connector", () => {
    const result = extractSalary("Salary range $75,000 to $95,000 per year.");
    expect(result).toMatchObject({ min: 75000, max: 95000, period: "annual" });
  });

  it("handles reversed min/max order by normalizing to min <= max", () => {
    const result = extractSalary("Pay: $110k-$80k depending on experience.");
    expect(result.min).toBe(80000);
    expect(result.max).toBe(110000);
  });

  it("never fabricates a currency other than USD (only $ is supported)", () => {
    const result = extractSalary("Salary: $80,000 - $100,000 per year.");
    expect(result.currency).toBe("USD");
  });
});
