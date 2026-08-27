import { describe, it, expect } from "vitest";
import {
  locationsMatch,
  computeSkillMatch,
  computeLocationMatch,
  computeSponsorshipMatch,
  computeSalaryMatch,
  computeExperienceMatch,
  computeJobMatch,
} from "./jobMatching.js";

// All job/profile fixtures below are clearly-synthetic test data, not real
// postings or real user profiles — per the no-fake-data rule, this module
// is verified purely through unit tests, never against a live `jobs` row.

const SYNTHETIC_JOB_REQUIRED = {
  title: "Backend Engineer",
  description:
    "Requirements: Python, SQL, and REST API experience are all required for this role. " +
    "Separately, Docker experience is preferred but not required.",
  location: "Seattle, WA",
  remoteType: "Hybrid",
  sponsorship: "Yes",
  salaryMin: 90000,
  salaryMax: 120000,
  experienceLevel: "Entry",
};

describe("locationsMatch", () => {
  it("matches when the job location is one of the preferred locations", () => {
    expect(locationsMatch("Seattle, WA; Remote", "Seattle, WA")).toBe(true);
  });

  it("matches case-insensitively and on partial substrings either direction", () => {
    expect(locationsMatch("seattle", "Seattle, WA, USA")).toBe(true);
    expect(locationsMatch("New York City", "new york")).toBe(true);
  });

  it("does not match unrelated locations", () => {
    expect(locationsMatch("Seattle, WA; Remote", "Austin, TX")).toBe(false);
  });

  it("returns false for an empty job location", () => {
    expect(locationsMatch("Seattle, WA", "")).toBe(false);
  });
});

describe("computeSkillMatch", () => {
  it("returns score: null when the job listing has no recognizable skills", () => {
    const job = { title: "Mystery Role", description: "Great culture, fast-paced environment." };
    const result = computeSkillMatch({ skills: ["python"] }, job);
    expect(result.score).toBeNull();
    expect(result.matchedSkills).toEqual([]);
  });

  it("prefers required-skill coverage when the JD has required/preferred signal language", () => {
    // JD requires python + sql + rest api, prefers docker.
    const profile = { skills: ["python", "sql"] };
    const result = computeSkillMatch(profile, SYNTHETIC_JOB_REQUIRED);
    expect(result.usedRequiredOnly).toBe(true);
    // 2 of 3 required skills matched (python, sql) -> docker/preferred excluded from the denominator.
    expect(result.totalConsidered).toBe(3);
    expect(result.matchedSkills.sort()).toEqual(["python", "sql"]);
    expect(result.missingSkills).toEqual(["rest api"]);
    expect(result.score).toBe(Math.round((2 / 3) * 100));
  });

  it("falls back to all-listed-skill coverage when nothing is classified required (silence still defaults required upstream, so use a JD with only preferred language after a required skill is already covered)", () => {
    // A JD where every mentioned skill sits right next to "nice to have" wording.
    const job = { title: "Role", description: "Nice to have: Java experience is a bonus. Preferred: SQL is a plus." };
    const profile = { skills: ["java"] };
    const result = computeSkillMatch(profile, job);
    // Both skills classified "preferred" (no required signal at all) -> falls back to using all listed skills as the basis.
    expect(result.usedRequiredOnly).toBe(false);
    expect(result.totalConsidered).toBe(2);
    expect(result.matchedSkills).toEqual(["java"]);
    expect(result.score).toBe(50);
  });

  it("gives full marks when every required skill is matched", () => {
    const profile = { skills: ["python", "sql", "rest api", "docker"] };
    const result = computeSkillMatch(profile, SYNTHETIC_JOB_REQUIRED);
    expect(result.score).toBe(100);
    expect(result.missingSkills).toEqual([]);
  });

  it("is not fooled by substring false-positives (reuses scoring.js's word-boundary matching)", () => {
    // "digital" should not register a "git" hit, mirroring scoring.test.js's coverage.
    const job = { title: "Marketing Ops", description: "Required: experience with digital marketing campaigns." };
    const profile = { skills: ["git"] };
    const result = computeSkillMatch(profile, job);
    expect(result.matchedSkills).not.toContain("git");
  });
});

describe("computeLocationMatch", () => {
  it("returns null when neither remote preference nor preferred locations apply", () => {
    const result = computeLocationMatch({}, { location: "Austin, TX" });
    expect(result.score).toBeNull();
  });

  it("scores 100 when both remote type and location match", () => {
    const profile = { remotePreference: "Hybrid", preferredLocations: "Seattle, WA" };
    const result = computeLocationMatch(profile, { location: "Seattle, WA", remoteType: "Hybrid" });
    expect(result.score).toBe(100);
  });

  it("averages when one matches and the other doesn't", () => {
    const profile = { remotePreference: "Remote", preferredLocations: "Seattle, WA" };
    const result = computeLocationMatch(profile, { location: "Seattle, WA", remoteType: "Onsite" });
    expect(result.score).toBe(50);
  });

  it("ignores remote preference of 'No preference'", () => {
    const profile = { remotePreference: "No preference", preferredLocations: "Austin, TX" };
    const result = computeLocationMatch(profile, { location: "Austin, TX", remoteType: "Onsite" });
    // Only the location comparison should count, and it matches -> 100.
    expect(result.score).toBe(100);
  });

  it("scores 0 when both are stated and neither matches", () => {
    const profile = { remotePreference: "Remote", preferredLocations: "Boston, MA" };
    const result = computeLocationMatch(profile, { location: "Austin, TX", remoteType: "Onsite" });
    expect(result.score).toBe(0);
  });
});

describe("computeSponsorshipMatch", () => {
  it("returns null when the employer hasn't stated a sponsorship policy", () => {
    const result = computeSponsorshipMatch({ requiresSponsorship: true }, {});
    expect(result.score).toBeNull();
  });

  it("scores 100 when the user requires sponsorship and the employer offers it", () => {
    const result = computeSponsorshipMatch({ requiresSponsorship: true }, { sponsorship: "Yes" });
    expect(result.score).toBe(100);
  });

  it("scores 0 when the user requires sponsorship and the employer does not offer it", () => {
    const result = computeSponsorshipMatch({ requiresSponsorship: true }, { sponsorship: "No" });
    expect(result.score).toBe(0);
    expect(result.detail).toMatch(/do not sponsor/i);
  });

  it("scores 50 (unknown) when the user requires sponsorship and the employer's policy is unmarked", () => {
    const result = computeSponsorshipMatch({ requiresSponsorship: true }, { sponsorship: "Unknown" });
    expect(result.score).toBe(50);
  });

  it("treats a 'No' sponsor as NOT a barrier when the user doesn't require sponsorship", () => {
    const result = computeSponsorshipMatch({ requiresSponsorship: false }, { sponsorship: "No" });
    expect(result.score).toBe(100);
    expect(result.detail).toMatch(/isn't a barrier/i);
  });

  it("treats requiresSponsorship undefined the same as false", () => {
    const result = computeSponsorshipMatch({}, { sponsorship: "No" });
    expect(result.score).toBe(100);
  });
});

describe("computeSalaryMatch", () => {
  it("returns null when the job has no salary range", () => {
    const result = computeSalaryMatch({ salaryExpectationMin: 80000, salaryExpectationMax: 100000 }, {});
    expect(result.score).toBeNull();
  });

  it("returns null when the user hasn't stated salary expectations", () => {
    const result = computeSalaryMatch({}, { salaryMin: 80000, salaryMax: 100000 });
    expect(result.score).toBeNull();
  });

  it("scores 100 when the ranges overlap", () => {
    const profile = { salaryExpectationMin: 90000, salaryExpectationMax: 110000 };
    const job = { salaryMin: 100000, salaryMax: 130000 };
    const result = computeSalaryMatch(profile, job);
    expect(result.score).toBe(100);
  });

  it("scores 100 when the job's range exceeds expectations entirely", () => {
    const profile = { salaryExpectationMin: 60000, salaryExpectationMax: 80000 };
    const job = { salaryMin: 90000, salaryMax: 110000 };
    const result = computeSalaryMatch(profile, job);
    expect(result.score).toBe(100);
    expect(result.detail).toMatch(/exceeds/i);
  });

  it("gives partial (not zero) credit when the job's range falls modestly short", () => {
    const profile = { salaryExpectationMin: 100000, salaryExpectationMax: 120000 };
    const job = { salaryMin: 80000, salaryMax: 95000 };
    const result = computeSalaryMatch(profile, job);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });
});

describe("computeExperienceMatch", () => {
  it("returns null when either side is missing", () => {
    expect(computeExperienceMatch({}, { experienceLevel: "Entry" }).score).toBeNull();
    expect(computeExperienceMatch({ experienceLevel: "Entry" }, {}).score).toBeNull();
  });

  it("scores 100 on an exact match", () => {
    const result = computeExperienceMatch({ experienceLevel: "Mid" }, { experienceLevel: "Mid" });
    expect(result.score).toBe(100);
  });

  it("gives partial credit for an adjacent level, less for a distant one", () => {
    const near = computeExperienceMatch({ experienceLevel: "Entry" }, { experienceLevel: "Mid" });
    const far = computeExperienceMatch({ experienceLevel: "Entry" }, { experienceLevel: "Executive" });
    expect(near.score).toBeGreaterThan(far.score);
    expect(far.score).toBeGreaterThanOrEqual(0);
  });
});

describe("computeJobMatch — overall breakdown + whyThisMatches", () => {
  it("returns overallMatchScore: null and a single honest fallback line when nothing is computable", () => {
    const result = computeJobMatch({}, { title: "Untitled", description: "" });
    expect(result.overallMatchScore).toBeNull();
    expect(result.whyThisMatches).toHaveLength(1);
    expect(result.whyThisMatches[0]).toMatch(/not enough/i);
  });

  it("computes a weighted overall score renormalized over available components only", () => {
    // Only skillMatch and sponsorshipMatch are computable here.
    const profile = { skills: ["python"], requiresSponsorship: false };
    const job = { title: "Role", description: "Required: Python.", sponsorship: "No" };
    const result = computeJobMatch(profile, job);
    expect(result.skillMatch.score).toBe(100);
    expect(result.sponsorshipMatch.score).toBe(100);
    expect(result.locationMatch.score).toBeNull();
    expect(result.salaryMatch.score).toBeNull();
    expect(result.experienceMatch.score).toBeNull();
    expect(result.overallMatchScore).toBe(100);
  });

  it("produces whyThisMatches strings genuinely derived from sub-scores, including the sponsorship framing example", () => {
    const profile = { requiresSponsorship: false, skills: [] };
    const job = { title: "Role", description: "", sponsorship: "No" };
    const result = computeJobMatch(profile, job);
    const sponsorshipLine = result.whyThisMatches.find((l) => l.startsWith("Sponsorship:"));
    expect(sponsorshipLine).toBeDefined();
    expect(sponsorshipLine).toMatch(/may not sponsor/i);
    expect(sponsorshipLine).toMatch(/doesn't require sponsorship/i);
  });

  it("full realistic fixture: matches most required skills, right location, right sponsorship", () => {
    const profile = {
      skills: ["python", "sql", "rest api"],
      targetRole: "Backend Engineer",
      requiresSponsorship: false,
      preferredLocations: "Seattle, WA",
      remotePreference: "Hybrid",
    };
    const result = computeJobMatch(profile, SYNTHETIC_JOB_REQUIRED);
    expect(result.skillMatch.score).toBe(100);
    expect(result.locationMatch.score).toBe(100);
    expect(result.sponsorshipMatch.score).toBe(100);
    expect(result.overallMatchScore).toBeGreaterThanOrEqual(90);
    expect(result.whyThisMatches.some((l) => l.includes("Matches 3 of 3 required skills"))).toBe(true);
  });

  it("never throws on completely empty inputs", () => {
    expect(() => computeJobMatch(undefined, undefined)).not.toThrow();
    expect(() => computeJobMatch(null, null)).not.toThrow();
  });
});
