import { describe, it, expect } from "vitest";
import {
  extractSkills,
  classifySkillsImportance,
  computeScoreBreakdown,
  missingSignals,
  extractSalary,
  computeDetailedAtsAnalysis,
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

describe("computeDetailedAtsAnalysis — standalone ATS check (Phase 7)", () => {
  const STRONG_RESUME = `
Jane Doe
jane.doe@example.com | (555) 123-4567

Professional Summary
Backend engineer with 5 years of experience building scalable APIs.

Experience
Software Engineer, Acme Corp, 2021 - Present
Increased API throughput by 45% by redesigning the caching layer using Redis.
Led a team of 4 engineers to migrate the platform to AWS, cutting infra costs by $120,000 annually.
Built a REST API used by over 200,000 daily active users.

Education
B.S. Computer Science, State University, 2017 - 2021

Skills
Python, JavaScript, React, Node, AWS, Docker, SQL, Git
`;

  const WEAK_RESUME = `
Experience
Responsible for helping the team.
Worked on various client projects.
Worked on internal tooling as well.
Hard worker and team player.
`;

  const JD_TEXT = `
We are looking for a Backend Engineer.
Requirements: must have strong Python and AWS experience. SQL is required.
Preferred qualifications: familiarity with Docker is a plus.
`;

  describe("keyword matching", () => {
    it("finds matched and missing keywords, with high coverage for a well-matched resume", () => {
      const result = computeDetailedAtsAnalysis(STRONG_RESUME, JD_TEXT);
      expect(result.keywords.matched).toEqual(
        expect.arrayContaining(["python", "aws", "sql", "docker"]),
      );
      expect(result.keywords.missing).toEqual([]);
      expect(result.keywords.coveragePercent).toBe(100);
      expect(result.breakdown.keywordMatch).toBe(100);
    });

    it("reports every JD skill as missing when the resume shares none of them", () => {
      const result = computeDetailedAtsAnalysis(
        "I enjoy hiking, painting, and playing the guitar on weekends.",
        JD_TEXT,
      );
      expect(result.keywords.matched).toEqual([]);
      expect(result.keywords.missing.length).toBeGreaterThan(0);
      expect(result.keywords.coveragePercent).toBe(0);
      expect(result.breakdown.keywordMatch).toBe(0);
    });

    it("never fabricates a coverage percentage when no job description is given", () => {
      const result = computeDetailedAtsAnalysis(STRONG_RESUME, "");
      expect(result.keywords.matched).toEqual([]);
      expect(result.keywords.missing).toEqual([]);
      expect(result.keywords.coveragePercent).toBe(100);
    });

    it("weighs required-classified JD skills more heavily in skillsMatch than raw keyword coverage", () => {
      const jd = "Requirements: must have Python and SQL. Preferred qualifications: Docker is a plus.";
      const resume = "Backend engineer with hands-on experience in Python and SQL.";
      const result = computeDetailedAtsAnalysis(resume, jd);
      expect(result.keywords.matched).toEqual(expect.arrayContaining(["python", "sql"]));
      expect(result.keywords.missing).toContain("docker");
      // Both required-classified skills (python, sql) are present, so
      // skillsMatch is perfect even though the missing preferred skill
      // (docker) drags the overall keyword coverage below 100.
      expect(result.breakdown.skillsMatch).toBe(100);
      expect(result.breakdown.keywordMatch).toBeLessThan(100);
    });
  });

  describe("structure detection", () => {
    it("detects all standard sections present in a well-formed resume", () => {
      const { structure } = computeDetailedAtsAnalysis(STRONG_RESUME, JD_TEXT);
      expect(structure.hasContactInfo).toBe(true);
      expect(structure.hasSummary).toBe(true);
      expect(structure.hasExperience).toBe(true);
      expect(structure.hasEducation).toBe(true);
      expect(structure.hasSkillsSection).toBe(true);
      expect(structure.issues).toEqual([]);
    });

    it("flags every missing whole section on a bare-bones resume", () => {
      const { structure } = computeDetailedAtsAnalysis(WEAK_RESUME, JD_TEXT);
      expect(structure.hasContactInfo).toBe(false);
      expect(structure.hasSummary).toBe(false);
      expect(structure.hasExperience).toBe(true);
      expect(structure.hasEducation).toBe(false);
      expect(structure.hasSkillsSection).toBe(false);
      expect(structure.issues).toEqual(
        expect.arrayContaining([
          "No email address or phone number detected",
          "No professional summary detected",
          "No education section detected",
          "No dedicated skills section detected",
          "No employment dates detected in the experience section",
        ]),
      );
    });

    it("does not flag a missing-dates issue when the experience section has date ranges", () => {
      const { structure } = computeDetailedAtsAnalysis(STRONG_RESUME, JD_TEXT);
      expect(structure.issues).not.toContain("No employment dates detected in the experience section");
    });
  });

  describe("content quality — weak bullets, generic statements, repeated phrases", () => {
    it("flags vague/passive filler bullets with no measurable outcome", () => {
      const { content } = computeDetailedAtsAnalysis(WEAK_RESUME, JD_TEXT);
      const flagged = content.weakBullets.map((b) => b.text.toLowerCase());
      expect(flagged.some((t) => t.includes("responsible for helping the team"))).toBe(true);
      const match = content.weakBullets.find((b) =>
        b.text.toLowerCase().includes("responsible for helping the team"),
      );
      expect(match.reason).toMatch(/passive|vague/i);
    });

    it("does NOT flag strong, quantified bullets as weak", () => {
      const { content } = computeDetailedAtsAnalysis(STRONG_RESUME, JD_TEXT);
      const flaggedTexts = content.weakBullets.map((b) => b.text.toLowerCase());
      expect(flaggedTexts.some((t) => t.includes("increased api throughput by 45%"))).toBe(false);
      expect(flaggedTexts.some((t) => t.includes("led a team of 4 engineers"))).toBe(false);
      expect(flaggedTexts.some((t) => t.includes("built a rest api used by over 200,000"))).toBe(false);
    });

    it("detects a generic self-description cliché", () => {
      const { content } = computeDetailedAtsAnalysis(WEAK_RESUME, JD_TEXT);
      expect(content.genericStatements.some((s) => s.toLowerCase().includes("hard worker"))).toBe(true);
    });

    it("does not flag a strong resume for generic clichés it doesn't contain", () => {
      const { content } = computeDetailedAtsAnalysis(STRONG_RESUME, JD_TEXT);
      expect(content.genericStatements).toEqual([]);
    });

    it("detects an exact filler phrase repeated across multiple bullets", () => {
      const { content } = computeDetailedAtsAnalysis(WEAK_RESUME, JD_TEXT);
      expect(content.repeatedPhrases).toContain("worked on");
    });

    it("reports no repeated filler phrases for a resume that doesn't repeat any", () => {
      const { content } = computeDetailedAtsAnalysis(STRONG_RESUME, JD_TEXT);
      expect(content.repeatedPhrases).toEqual([]);
    });
  });

  describe("overall scoring", () => {
    it("scores a strong, well-matched resume clearly higher than a weak, unmatched one", () => {
      const strong = computeDetailedAtsAnalysis(STRONG_RESUME, JD_TEXT);
      const weak = computeDetailedAtsAnalysis(WEAK_RESUME, JD_TEXT);
      expect(strong.overallScore).toBeGreaterThan(weak.overallScore);
    });

    it("keeps every score bounded 0-100 and finite, including on empty input", () => {
      for (const [resume, jd] of [
        [STRONG_RESUME, JD_TEXT],
        [WEAK_RESUME, JD_TEXT],
        ["", ""],
        [undefined, undefined],
      ]) {
        const result = computeDetailedAtsAnalysis(resume, jd);
        const values = [
          result.overallScore,
          result.breakdown.keywordMatch,
          result.breakdown.formatting,
          result.breakdown.experienceRelevance,
          result.breakdown.skillsMatch,
        ];
        for (const v of values) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    });

    it("does not crash on completely empty input and returns empty keyword/content arrays", () => {
      const result = computeDetailedAtsAnalysis("", "");
      expect(result.keywords.matched).toEqual([]);
      expect(result.keywords.missing).toEqual([]);
      expect(result.content.weakBullets).toEqual([]);
      expect(result.content.genericStatements).toEqual([]);
      expect(result.content.repeatedPhrases).toEqual([]);
    });
  });
});

describe("computeScoreBreakdown — now sourced from computeDetailedAtsAnalysis (Phase 7)", () => {
  it("still returns a bounded ats score when jobDescriptionText is omitted (backward compatible call shape)", () => {
    const skills = [{ name: "python", status: "hit", importance: "required" }];
    const { breakdown } = computeScoreBreakdown({
      skills,
      resumeText: "Experience: built things with Python. Skills: Python.",
      numPages: 1,
      signals: [],
    });
    expect(breakdown.ats).toBeGreaterThanOrEqual(0);
    expect(breakdown.ats).toBeLessThanOrEqual(100);
  });

  it("produces a different (JD-aware) ats score when jobDescriptionText is provided vs. omitted", () => {
    const skills = [{ name: "python", status: "hit", importance: "required" }];
    const resumeText = "I enjoy hiking and painting on weekends.";
    const withoutJd = computeScoreBreakdown({ skills, resumeText, numPages: 1, signals: [] });
    const withJd = computeScoreBreakdown({
      skills,
      resumeText,
      numPages: 1,
      signals: [],
      jobDescriptionText: "Requirements: must have Python, AWS, and SQL experience.",
    });
    // No JD skills to miss => full marks; a JD whose required skills are
    // entirely absent from the resume should score meaningfully lower.
    expect(withJd.breakdown.ats).toBeLessThan(withoutJd.breakdown.ats);
  });
});
