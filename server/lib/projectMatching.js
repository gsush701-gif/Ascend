// GitHub-repo-to-skill-gap matching (Phase 7 Task 9). Given a user's
// missing-required skills (the exact shape SkillGapHelper.tsx and
// server/lib/scoring.js's classifySkillsImportance already produce/consume)
// and their selected `github_repositories` rows, this figures out which
// existing repo (if any) already demonstrates a given missing skill — so
// the UI can say "your GitHub project X already covers this" instead of
// only ever suggesting a brand-new project idea via groq.recommendProject.
//
// Deliberately reuses this codebase's existing engines rather than
// inventing new matching logic, same discipline as server/lib/jobMatching.js:
//   - server/lib/scoring.js's `extractSkills` for turning a repo's raw
//     metadata (name, description, topics, primary language) into the same
//     canonical skill vocabulary used everywhere else in this app (so "js"
//     in a repo topic and "JavaScript" as a JD-extracted skill both resolve
//     to the same canonical "javascript" — no separate skill dictionary).
//   - `norm` for case/whitespace-insensitive comparison against the
//     already-canonical missingRequiredSkills list callers pass in.
//
// Pure functions only — no I/O, no Supabase, no Groq — unit-testable
// against synthetic fixtures (see projectMatching.test.js), matching
// jobMatching.js's own "pure engine, route handler does the I/O" split.
// Never fabricates a match: a repo only "covers" a skill when extractSkills
// actually finds that canonical skill in its own real metadata text.

const { extractSkills, norm } = require("./scoring");

/**
 * @typedef {Object} GithubRepoRow - subset of the `github_repositories` row
 * this module needs, camelCase (see supabase/migrations/021_github_integration.sql)
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {Record<string, boolean>|null} [languages]
 * @property {string[]} [topics]
 * @property {string} [pushedAt] - ISO timestamp, used only to break ties (most recently pushed wins)
 *
 * @typedef {Object} RepoSkillMatch
 * @property {string} repoId
 * @property {string} repoName
 * @property {string[]} matchedSkills - subset of the input missingRequiredSkills this repo's own metadata evidences
 * @property {string[]} repoSkills - every canonical skill extracted from this repo's metadata (not just the matched ones), for display/debugging
 *
 * @typedef {Object} ProjectMatchResult
 * @property {RepoSkillMatch[]} repoMatches - one entry per repo passed in, sorted by matchedSkills.length desc (ties: most recently pushed first), only repos with at least one matched skill included
 * @property {RepoSkillMatch|null} recommendedRepo - repoMatches[0], or null if no repo covers any missing skill
 * @property {string[]} uncoveredSkills - missingRequiredSkills not evidenced by any repo, in the same order they were passed in
 */

/**
 * Builds one text blob from a repo's own real metadata — name, description,
 * topics, and the keys of its `languages` map — for extractSkills to run
 * against. Never includes anything not actually present on the repo (a repo
 * with no description/topics/languages still works, it just yields fewer
 * or zero extracted skills, which is the honest outcome).
 */
function buildRepoSkillText(repo) {
  const parts = [repo.name, repo.description, ...(Array.isArray(repo.topics) ? repo.topics : [])];
  if (repo.languages && typeof repo.languages === "object") {
    parts.push(...Object.keys(repo.languages));
  }
  return parts.filter(Boolean).join(" ");
}

/** Canonical skills this repo's own metadata evidences — see buildRepoSkillText. */
function extractRepoSkills(repo) {
  return extractSkills(buildRepoSkillText(repo));
}

/**
 * Computes, for one repo, which of `missingRequiredSkills` it demonstrably
 * covers. Returns null (not a zero-match object) when the repo covers
 * nothing, so callers can filter it out without an extra check.
 * @param {string[]} missingRequiredSkills
 * @param {GithubRepoRow} repo
 * @returns {RepoSkillMatch|null}
 */
function matchRepoToSkillGaps(missingRequiredSkills, repo) {
  const repoSkills = extractRepoSkills(repo);
  const repoSkillSet = new Set(repoSkills.map((s) => norm(s)));
  const matchedSkills = (missingRequiredSkills || []).filter((s) => repoSkillSet.has(norm(s)));
  if (matchedSkills.length === 0) return null;
  return { repoId: repo.id, repoName: repo.name, matchedSkills, repoSkills };
}

function pushedAtMs(repo) {
  const t = repo.pushedAt ? Date.parse(repo.pushedAt) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Full matching pass: which selected repo(s) best demonstrate a user's
 * missing required skills, and which gaps remain uncovered by anything they
 * already have on GitHub — the input for "suggest what a new project could
 * cover" (via groq.recommendProject on the frontend, over `uncoveredSkills`
 * instead of the full missing-skills list, once this module identifies
 * what's already covered).
 * @param {string[]} missingRequiredSkills
 * @param {GithubRepoRow[]} repos - typically the user's `is_selected: true` rows only; callers decide what to pass in
 * @returns {ProjectMatchResult}
 */
function computeProjectMatch(missingRequiredSkills, repos) {
  const skills = Array.isArray(missingRequiredSkills) ? missingRequiredSkills : [];
  const safeRepos = Array.isArray(repos) ? repos : [];

  const repoMatches = safeRepos
    .map((repo) => matchRepoToSkillGaps(skills, repo))
    .filter(Boolean)
    .sort((a, b) => {
      if (b.matchedSkills.length !== a.matchedSkills.length) return b.matchedSkills.length - a.matchedSkills.length;
      const repoA = safeRepos.find((r) => r.id === a.repoId);
      const repoB = safeRepos.find((r) => r.id === b.repoId);
      return pushedAtMs(repoB) - pushedAtMs(repoA);
    });

  const coveredSet = new Set();
  for (const match of repoMatches) {
    for (const s of match.matchedSkills) coveredSet.add(norm(s));
  }
  const uncoveredSkills = skills.filter((s) => !coveredSet.has(norm(s)));

  return {
    repoMatches,
    recommendedRepo: repoMatches[0] || null,
    uncoveredSkills,
  };
}

module.exports = {
  buildRepoSkillText,
  extractRepoSkills,
  matchRepoToSkillGaps,
  computeProjectMatch,
};
