// Job recommendation/matching engine (Phase 7 Task 8). This is the genuinely
// buildable, genuinely testable part of Job Discovery — it operates on
// whatever `jobs` rows exist (real or, today, none) and a user's own
// profile, and produces an explainable breakdown, never a numeric score
// with no backing signal and never AI-fabricated flattery.
//
// Deliberately reuses this codebase's existing engines rather than
// reinventing them:
//   - server/lib/scoring.js's `extractSkills`/`classifySkillsImportance` for
//     the skill-match component (the same word-boundary-aware matching and
//     required-vs-preferred proximity heuristic used by /analyze and the
//     ATS checker).
//   - The same location/remote-preference and sponsorship reasoning as
//     src/features/preferences/compatibility.ts's `getCompatibilityNotes`,
//     ported here so it can run server-side over DB rows instead of a
//     TrackerItem — see `locationsMatch`/`computeLocationMatch`/
//     `computeSponsorshipMatch` below; the wording and match/mismatch/info
//     tone judgments intentionally mirror that file, not a new invention.
//   - server/lib/scoring.js's salary-range convention (a range is either
//     genuinely present or the component is left `null`, never fabricated)
//     for `computeSalaryMatch`, compared against the user's own salary
//     expectations *if available* (this app doesn't collect that field on
//     `profiles` yet, so this component is honestly `null` until it does —
//     see the doc comment on `computeSalaryMatch`).
//
// Pure functions only — no I/O, no Supabase, no Groq — so this whole module
// is unit-testable against synthetic fixtures with zero real job data
// (see jobMatching.test.js). The route handler (server/index.js's
// GET /api/jobs/recommendations) is the only place that fetches real rows
// and maps them into the plain-object shapes these functions accept.

const { extractSkills, classifySkillsImportance, norm } = require("./scoring");

/**
 * @typedef {Object} UserJobProfile
 * @property {string[]} [skills] - canonical skills already extracted from the
 *   user's resume (e.g. via scoring.js's extractSkills on their resume text)
 * @property {string} [targetRole]
 * @property {string} [workAuthorization]
 * @property {boolean} [requiresSponsorship]
 * @property {string} [preferredLocations] - free text, "Seattle, WA; Remote"
 * @property {string} [remotePreference] - "Remote" | "Hybrid" | "Onsite" | "No preference"
 * @property {string} [experienceLevel] - not currently collected on `profiles`; accepted for forward-compat
 * @property {number} [salaryExpectationMin] - not currently collected on `profiles`; accepted for forward-compat
 * @property {number} [salaryExpectationMax]
 *
 * @typedef {Object} MatchJob - subset of the `jobs` table this module needs, camelCase
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [location]
 * @property {string} [remoteType]
 * @property {string} [sponsorship] - "Yes" | "No" | "Unknown"
 * @property {number} [salaryMin]
 * @property {number} [salaryMax]
 * @property {string} [experienceLevel]
 *
 * @typedef {Object} MatchComponent
 * @property {number|null} score - 0-100, or null when there isn't enough data on either side to compare
 * @property {string} detail - a plain-language, genuinely-derived explanation of this component
 */

// Weights used for the overall score, renormalized over whichever
// components actually have a real (non-null) score — mirrors
// scoring.js's computeScoreBreakdown's "never compute a percentage from an
// empty/unavailable set" discipline, just applied to a weighted average
// instead of a single ratio.
const MATCH_WEIGHTS = Object.freeze({
  skillMatch: 0.4,
  locationMatch: 0.15,
  sponsorshipMatch: 0.15,
  salaryMatch: 0.15,
  experienceMatch: 0.15,
});

const EXPERIENCE_LEVEL_ORDER = ["Internship", "Entry", "Mid", "Senior", "Lead", "Executive"];

function round(n) {
  return Math.round(n);
}

/**
 * Ported from src/features/preferences/compatibility.ts's `locationsMatch`
 * (same semicolon/comma-split, case-insensitive substring-either-way logic)
 * so server-side matching reasons about location the exact same way the
 * existing role-compatibility notes UI does.
 */
function locationsMatch(preferred, jobLocation) {
  const jobLower = (jobLocation || "").trim().toLowerCase();
  if (!jobLower) return false;
  return (preferred || "")
    .split(/[;,]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((pref) => jobLower.includes(pref) || pref.includes(jobLower));
}

/**
 * Skill match: reuses scoring.js's extractSkills + classifySkillsImportance
 * exactly as /analyze and the ATS checker do. Prefers required-skill
 * coverage (the same "required skills matter most" judgment
 * computeScoreBreakdown already makes); falls back to all-listed-skill
 * coverage when the JD-classification heuristic found no explicit signal
 * language to distinguish required from preferred. Returns score: null only
 * when the job listing has no recognizable skills at all to compare against
 * — never fabricates a percentage from an empty comparison set.
 */
function computeSkillMatch(profile, job) {
  const jobText = [job.title, job.description].filter(Boolean).join("\n");
  const jobSkills = extractSkills(jobText);

  if (jobSkills.length === 0) {
    return {
      score: null,
      matchedSkills: [],
      missingSkills: [],
      totalConsidered: 0,
      usedRequiredOnly: false,
      detail: "This job posting doesn't list enough recognizable skills to compare against your profile.",
    };
  }

  const importance = classifySkillsImportance(job.description || job.title || "", jobSkills);
  const requiredSkills = jobSkills.filter((s) => importance[s] === "required");
  const usedRequiredOnly = requiredSkills.length > 0;
  const basis = usedRequiredOnly ? requiredSkills : jobSkills;

  const userSkillSet = new Set((profile.skills || []).map((s) => norm(s)));
  const matched = basis.filter((s) => userSkillSet.has(norm(s)));
  const missing = basis.filter((s) => !userSkillSet.has(norm(s)));
  const score = round((matched.length / basis.length) * 100);
  const label = usedRequiredOnly ? "required" : "listed";

  return {
    score,
    matchedSkills: matched,
    missingSkills: missing,
    totalConsidered: basis.length,
    usedRequiredOnly,
    detail:
      `Matches ${matched.length} of ${basis.length} ${label} skill${basis.length === 1 ? "" : "s"}` +
      (missing.length > 0 ? ` — missing: ${missing.slice(0, 5).join(", ")}.` : "."),
  };
}

/**
 * Location/remote-type match: same two comparisons as
 * compatibility.ts's getCompatibilityNotes (remote-type equality,
 * preferred-locations substring match), averaged into one score when both
 * are available. Returns score: null when neither side has anything to
 * compare (matching that file's "return [] when there's nothing on both
 * sides" behavior, just as a single nullable component instead of a notes
 * array).
 */
function computeLocationMatch(profile, job) {
  const parts = [];
  let sum = 0;
  let count = 0;

  const hasRemotePref = Boolean(profile.remotePreference) && profile.remotePreference !== "No preference";
  if (hasRemotePref && job.remoteType) {
    const match = job.remoteType === profile.remotePreference;
    sum += match ? 100 : 0;
    count += 1;
    parts.push(
      match
        ? `Remote type (${job.remoteType}) matches your preference.`
        : `Remote type is ${job.remoteType}; your preference is ${profile.remotePreference}.`,
    );
  }

  if (profile.preferredLocations && job.location) {
    const match = locationsMatch(profile.preferredLocations, job.location);
    sum += match ? 100 : 0;
    count += 1;
    parts.push(
      match
        ? `Location (${job.location}) matches one of your preferred locations.`
        : `Location is ${job.location}; your preferences are "${profile.preferredLocations}".`,
    );
  }

  if (count === 0) {
    return { score: null, detail: "Not enough location/remote-preference data to compare." };
  }
  return { score: round(sum / count), detail: parts.join(" ") };
}

/**
 * Sponsorship match: same reasoning and tone as compatibility.ts's
 * sponsorship notes (match/mismatch/info), condensed to one component.
 * A "No" from the employer is only ever a problem when the user's profile
 * says they require sponsorship — otherwise it's explicitly framed as not a
 * barrier, matching the spec's own illustrative example.
 */
function computeSponsorshipMatch(profile, job) {
  if (!job.sponsorship) {
    return { score: null, detail: "This employer hasn't stated a sponsorship policy." };
  }

  const requires = profile.requiresSponsorship === true;

  if (requires) {
    if (job.sponsorship === "Yes") {
      return { score: 100, detail: "This employer indicates they sponsor work visas — matches your stated need." };
    }
    if (job.sponsorship === "No") {
      return {
        score: 0,
        detail:
          "This employer indicates they do not sponsor work visas, but your profile says you require sponsorship — worth confirming directly before investing more time.",
      };
    }
    return {
      score: 50,
      detail: "This employer's sponsorship policy is marked unknown — you've indicated you require sponsorship, so it's worth confirming directly.",
    };
  }

  if (job.sponsorship === "No") {
    return {
      score: 100,
      detail: "This employer may not sponsor work visas, but your profile doesn't require sponsorship, so this isn't a barrier.",
    };
  }
  return { score: 100, detail: "Sponsorship isn't a constraint for your profile." };
}

/**
 * Salary match: compares the job's own salary_min/salary_max (already
 * numeric columns on `jobs` — no regex extraction needed here, unlike
 * scoring.js's extractSalary which parses salary out of free JD text) against
 * the user's stated salary expectations, *if available*. `profiles` has no
 * salary-expectation columns yet (only work_authorization/
 * requires_sponsorship/preferred_locations/remote_preference exist —
 * supabase/migrations/014_profile_preferences.sql), so
 * `profile.salaryExpectationMin/Max` will be undefined for every real user
 * today and this component will honestly resolve to `null` rather than
 * comparing against a number nobody entered. The fields are still accepted
 * here so this module doesn't need to change again once that profile field
 * is added — same "architecture ready, not faked" spirit as the rest of
 * this feature.
 */
function computeSalaryMatch(profile, job) {
  const jobMin = typeof job.salaryMin === "number" ? job.salaryMin : null;
  const jobMax = typeof job.salaryMax === "number" ? job.salaryMax : null;
  const expMin = typeof profile.salaryExpectationMin === "number" ? profile.salaryExpectationMin : null;
  const expMax = typeof profile.salaryExpectationMax === "number" ? profile.salaryExpectationMax : null;

  if (jobMin === null && jobMax === null) {
    return { score: null, detail: "This job posting doesn't list a salary range." };
  }
  if (expMin === null && expMax === null) {
    return { score: null, detail: "Add your salary expectations to your profile to compare against this job's range." };
  }

  const jobLo = jobMin ?? jobMax;
  const jobHi = jobMax ?? jobMin;
  const expLo = expMin ?? expMax;
  const expHi = expMax ?? expMin;

  const overlap = Math.min(jobHi, expHi) - Math.max(jobLo, expLo);
  if (overlap >= 0) {
    return { score: 100, detail: "This job's salary range overlaps with your stated expectations." };
  }
  if (jobHi < expLo) {
    // Job's range tops out below what the user wants — partial credit
    // scaled by how far short it falls, never a hard 0 for "somewhat below".
    const gap = expLo - jobHi;
    const ratio = Math.max(0, 1 - gap / expLo);
    return { score: round(ratio * 100), detail: "This job's salary range tops out below your stated expectations." };
  }
  // jobLo > expHi: job's range starts above what the user asked for — not a downside.
  return { score: 100, detail: "This job's salary range exceeds your stated expectations." };
}

/**
 * Experience-level match: `profiles` has no experience-level column either
 * (see computeSalaryMatch's comment for the same situation) — accepted here
 * for forward-compat, honestly `null` until that field exists or is derived
 * from something else. Uses a simple ordered-distance scale so "Entry" vs.
 * "Mid" reads as a near-miss, not a total mismatch, when both sides are
 * eventually available.
 */
function computeExperienceMatch(profile, job) {
  if (!profile.experienceLevel || !job.experienceLevel) {
    return { score: null, detail: "Not enough experience-level data to compare." };
  }
  const a = EXPERIENCE_LEVEL_ORDER.indexOf(profile.experienceLevel);
  const b = EXPERIENCE_LEVEL_ORDER.indexOf(job.experienceLevel);
  if (a === -1 || b === -1) {
    return { score: null, detail: "Couldn't compare experience levels." };
  }
  const distance = Math.abs(a - b);
  const score = Math.max(0, 100 - distance * 30);
  return {
    score,
    detail:
      distance === 0
        ? `Experience level matches (${job.experienceLevel}).`
        : `This role is ${job.experienceLevel}; your profile is ${profile.experienceLevel}.`,
  };
}

function computeOverallScore(components) {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(MATCH_WEIGHTS)) {
    const component = components[key];
    if (component && typeof component.score === "number") {
      weightedSum += component.score * weight;
      weightTotal += weight;
    }
  }
  if (weightTotal === 0) return null;
  return round(weightedSum / weightTotal);
}

function lowerFirst(s) {
  return s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/**
 * Builds the `whyThisMatches` list directly from each component's own
 * `detail` string — never separately AI-generated, so it can never drift
 * from (or embellish beyond) what the sub-scores actually found. A
 * component with score: null is omitted rather than padded with a vague
 * line, except when literally nothing was computable, in which case a
 * single honest fallback line is returned instead of an empty array.
 */
function buildWhyThisMatches(components) {
  const { skillMatch, locationMatch, sponsorshipMatch, salaryMatch, experienceMatch } = components;
  const notes = [];
  if (skillMatch.score !== null) notes.push(skillMatch.detail);
  if (sponsorshipMatch.score !== null) notes.push(`Sponsorship: ${lowerFirst(sponsorshipMatch.detail)}`);
  if (locationMatch.score !== null) notes.push(locationMatch.detail);
  if (salaryMatch.score !== null) notes.push(salaryMatch.detail);
  if (experienceMatch.score !== null) notes.push(experienceMatch.detail);
  if (notes.length === 0) {
    notes.push("Not enough profile or job-listing data yet to explain this match in detail.");
  }
  return notes;
}

/**
 * Computes the full explainable match breakdown for one (profile, job) pair.
 * Pure, deterministic, no I/O.
 * @param {UserJobProfile} profile
 * @param {MatchJob} job
 * @returns {{overallMatchScore: number|null, skillMatch: MatchComponent, locationMatch: MatchComponent, sponsorshipMatch: MatchComponent, salaryMatch: MatchComponent, experienceMatch: MatchComponent, whyThisMatches: string[]}}
 */
function computeJobMatch(profile, job) {
  const safeProfile = profile || {};
  const safeJob = job || {};

  const skillMatch = computeSkillMatch(safeProfile, safeJob);
  const locationMatch = computeLocationMatch(safeProfile, safeJob);
  const sponsorshipMatch = computeSponsorshipMatch(safeProfile, safeJob);
  const salaryMatch = computeSalaryMatch(safeProfile, safeJob);
  const experienceMatch = computeExperienceMatch(safeProfile, safeJob);

  const components = { skillMatch, locationMatch, sponsorshipMatch, salaryMatch, experienceMatch };
  const overallMatchScore = computeOverallScore(components);
  const whyThisMatches = buildWhyThisMatches(components);

  return { overallMatchScore, ...components, whyThisMatches };
}

module.exports = {
  MATCH_WEIGHTS,
  EXPERIENCE_LEVEL_ORDER,
  locationsMatch,
  computeSkillMatch,
  computeLocationMatch,
  computeSponsorshipMatch,
  computeSalaryMatch,
  computeExperienceMatch,
  computeJobMatch,
};
