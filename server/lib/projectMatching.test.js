import { describe, it, expect } from "vitest";
import {
  buildRepoSkillText,
  extractRepoSkills,
  matchRepoToSkillGaps,
  computeProjectMatch,
} from "./projectMatching.js";

// All repo fixtures below are clearly-synthetic test data, not real GitHub
// repos — per the no-fake-data rule, this module is verified purely
// through unit tests, never against a live github_repositories row.

const REACT_REPO = {
  id: "repo-1",
  name: "job-tracker-api",
  description: "A REST API for tracking job applications, built with Node and Express.",
  languages: { JavaScript: true },
  topics: ["rest-api", "node", "express"],
  pushedAt: "2026-06-01T00:00:00Z",
};

const PYTHON_REPO = {
  id: "repo-2",
  name: "data-pipeline",
  description: "A Python ETL pipeline using SQL for storage.",
  languages: { Python: true },
  topics: ["python", "sql", "docker"],
  pushedAt: "2026-07-01T00:00:00Z",
};

const EMPTY_REPO = {
  id: "repo-3",
  name: "notes",
  description: null,
  languages: null,
  topics: [],
  pushedAt: "2026-01-01T00:00:00Z",
};

describe("buildRepoSkillText", () => {
  it("joins name, description, topics, and language keys", () => {
    const text = buildRepoSkillText(REACT_REPO);
    expect(text).toContain("job-tracker-api");
    expect(text).toContain("REST API");
    expect(text).toContain("rest-api");
    expect(text).toContain("JavaScript");
  });

  it("handles a repo with no description/topics/languages without throwing", () => {
    expect(() => buildRepoSkillText(EMPTY_REPO)).not.toThrow();
    expect(buildRepoSkillText(EMPTY_REPO)).toBe("notes");
  });
});

describe("extractRepoSkills", () => {
  it("extracts canonical skills from a repo's real metadata", () => {
    const skills = extractRepoSkills(REACT_REPO);
    expect(skills).toContain("rest api");
    expect(skills).toContain("node");
    expect(skills).toContain("express");
    expect(skills).toContain("javascript");
  });

  it("extracts nothing fabricated for a repo with no metadata", () => {
    expect(extractRepoSkills(EMPTY_REPO)).toEqual([]);
  });

  it("does not fabricate skills the repo's metadata never mentions", () => {
    const skills = extractRepoSkills(REACT_REPO);
    expect(skills).not.toContain("kubernetes");
    expect(skills).not.toContain("python");
  });
});

describe("matchRepoToSkillGaps", () => {
  it("returns matched skills when the repo genuinely evidences them", () => {
    const result = matchRepoToSkillGaps(["rest api", "node", "kubernetes"], REACT_REPO);
    expect(result).not.toBeNull();
    expect(result.repoId).toBe("repo-1");
    expect(result.matchedSkills.sort()).toEqual(["node", "rest api"]);
  });

  it("returns null when the repo covers none of the missing skills", () => {
    const result = matchRepoToSkillGaps(["kubernetes", "azure"], REACT_REPO);
    expect(result).toBeNull();
  });

  it("returns null for an empty missing-skills list", () => {
    expect(matchRepoToSkillGaps([], REACT_REPO)).toBeNull();
  });

  it("is case/whitespace-insensitive against the canonical skill names", () => {
    const result = matchRepoToSkillGaps(["  Node  ", "REST API"], REACT_REPO);
    expect(result).not.toBeNull();
    expect(result.matchedSkills.sort()).toEqual(["  Node  ", "REST API"].sort());
  });
});

describe("computeProjectMatch", () => {
  it("recommends the repo covering the most missing skills", () => {
    const result = computeProjectMatch(["python", "sql", "node"], [REACT_REPO, PYTHON_REPO, EMPTY_REPO]);
    expect(result.recommendedRepo).not.toBeNull();
    expect(result.recommendedRepo.repoId).toBe("repo-2"); // covers python + sql (2) vs. react repo's node (1)
  });

  it("returns uncoveredSkills for gaps no repo demonstrates", () => {
    const result = computeProjectMatch(["python", "kubernetes", "azure"], [PYTHON_REPO]);
    expect(result.uncoveredSkills).toEqual(["kubernetes", "azure"]);
  });

  it("returns recommendedRepo: null and all skills uncovered when no repos are passed", () => {
    const result = computeProjectMatch(["python", "sql"], []);
    expect(result.recommendedRepo).toBeNull();
    expect(result.repoMatches).toEqual([]);
    expect(result.uncoveredSkills).toEqual(["python", "sql"]);
  });

  it("returns recommendedRepo: null when repos exist but cover nothing", () => {
    const result = computeProjectMatch(["kubernetes", "azure"], [REACT_REPO, PYTHON_REPO]);
    expect(result.recommendedRepo).toBeNull();
    expect(result.uncoveredSkills).toEqual(["kubernetes", "azure"]);
  });

  it("breaks a tie in matched-skill count by most recently pushed repo", () => {
    const olderReact = { ...REACT_REPO, id: "repo-old", pushedAt: "2020-01-01T00:00:00Z" };
    const newerReact = { ...REACT_REPO, id: "repo-new", pushedAt: "2026-01-01T00:00:00Z" };
    const result = computeProjectMatch(["node"], [olderReact, newerReact]);
    expect(result.recommendedRepo.repoId).toBe("repo-new");
  });

  it("never fabricates a match — an empty missing-skills list yields no recommendation", () => {
    const result = computeProjectMatch([], [REACT_REPO, PYTHON_REPO]);
    expect(result.recommendedRepo).toBeNull();
    expect(result.repoMatches).toEqual([]);
    expect(result.uncoveredSkills).toEqual([]);
  });

  it("handles undefined/null inputs defensively without throwing", () => {
    expect(() => computeProjectMatch(undefined, undefined)).not.toThrow();
    expect(computeProjectMatch(undefined, undefined).recommendedRepo).toBeNull();
    expect(() => computeProjectMatch(["node"], null)).not.toThrow();
  });

  it("includes every genuinely covered skill across multiple repos in the coverage accounting", () => {
    const result = computeProjectMatch(["node", "python", "sql"], [REACT_REPO, PYTHON_REPO]);
    expect(result.uncoveredSkills).toEqual([]);
    // Both repos matched something, so both should appear in repoMatches.
    const repoIds = result.repoMatches.map((m) => m.repoId).sort();
    expect(repoIds).toEqual(["repo-1", "repo-2"]);
  });
});
