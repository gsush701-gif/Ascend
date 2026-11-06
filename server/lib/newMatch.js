// "New match": the one fresh posting in the job feed that fits this student
// best, for the This week card. It reuses the same matcher as the
// Recommendations tab (server/lib/jobMatching.js), so the score on the card is
// the score they will see on the Jobs page.
//
// A posting is only suggested when it clears a few honest bars, because one
// wrong suggestion costs more trust than a missing one earns:
//   - the student has a resume with recognisable skills (otherwise there is
//     nothing to match, and the card already asks them to add one);
//   - it was posted recently (a known date within FRESH_DAYS);
//   - the overall match is at least MIN_SCORE, built on at least MIN_SKILLS
//     skills the posting actually names, so a lucky 100% from one skill never
//     qualifies;
//   - they have not dismissed it and are not already tracking it.
//
// Pure function over plain data, so it is unit-tested (newMatch.test.js).

const { computeJobMatch, jobRowToMatchJob, rankValue, locationsMatch } = require("./jobMatching");

const DAY_MS = 24 * 60 * 60 * 1000;
const FRESH_DAYS = 30;
const MIN_SCORE = 60;
const MIN_SKILLS = 3;
const MIN_MATCHED_SKILLS = 3;

const FRESHNESS_PENALTY_PER_DAY = 0.4;
// Ascend is aimed at students in the United States today, so with no stated
// location a US posting gets a small boost. A stated location overrides this.
const US_BONUS = 12;
const US_STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ").join("|");
const US_PATTERN = new RegExp("\\b(United States|USA)\\b|\\bU\\.S\\.|,\\s*(" + US_STATES + ")\\b|\\bUS\\b");
function looksUS(location) {
  return typeof location === "string" && US_PATTERN.test(location);
}
const TARGET_ROLE_BONUS = 15;
const TARGET_ROLE_STOPWORDS = new Set([
  "intern", "interns", "internship", "internships", "junior", "entry", "level", "new", "grad", "graduate",
  "the", "and", "for", "role", "roles", "position", "job", "jobs", "summer", "fall", "spring", "winter",
]);

function key(company, title) {
  return `${String(company || "").trim().toLowerCase()}|${String(title || "").trim().toLowerCase()}`;
}

/** The meaningful words of the student's own target role ("Software Engineer Intern" -> software, engineer). */
function targetRoleWords(targetRole) {
  return String(targetRole || "")
    .toLowerCase()
    .split(/[^a-z+#]+/)
    .filter((w) => w.length >= 3 && !TARGET_ROLE_STOPWORDS.has(w));
}

/**
 * @param {object} input
 * @param {Array<object>} input.jobs open `jobs` rows
 * @param {object} input.profile from buildMatchProfile
 * @param {Set<string>} [input.dismissedIds] job ids the student dismissed
 * @param {Set<string>} [input.trackedJobIds] job ids already on their roles
 * @param {Set<string>} [input.trackedKeys] "company|title" of roles they already track
 * @param {Date} [input.now]
 * @returns {null | { job: object, score: number, matchedSkills: string[], missingSkills: string[], daysAgo: number }}
 */
function pickNewMatch({
  jobs = [],
  profile,
  dismissedIds = new Set(),
  trackedJobIds = new Set(),
  trackedKeys = new Set(),
  now = new Date(),
} = {}) {
  if (!profile || !Array.isArray(profile.skills) || profile.skills.length === 0) return null;

  const roleWords = targetRoleWords(profile.targetRole);
  const hasLocationPref = Boolean(profile.preferredLocations && String(profile.preferredLocations).trim());
  let best = null;
  for (const row of jobs) {
    if (!row || dismissedIds.has(row.id) || trackedJobIds.has(row.id)) continue;
    if (trackedKeys.has(key(row.company, row.title))) continue;

    const posted = row.posted_at ? Date.parse(row.posted_at) : NaN;
    if (!Number.isFinite(posted)) continue;
    const ageMs = now.getTime() - posted;
    if (ageMs > FRESH_DAYS * DAY_MS) continue;

    // A location the student asked for is a requirement, except for remote roles.
    if (
      hasLocationPref &&
      row.location &&
      row.remote_type !== "Remote" &&
      !locationsMatch(profile.preferredLocations, row.location)
    ) {
      continue;
    }

    const matchJob = jobRowToMatchJob(row);
    // A remote role can be done from anywhere, so its office location should not
    // count against a student who asked for a particular city.
    if (hasLocationPref && row.remote_type === "Remote") matchJob.location = undefined;
    const match = computeJobMatch(profile, matchJob);
    const score = match.overallMatchScore;
    if (score === null || score < MIN_SCORE) continue;
    if ((match.skillMatch.totalConsidered || 0) < MIN_SKILLS) continue;

    // Ranking only: strength of the match, a bonus when the title fits the role
    // the student said they want, and a small cost for each day since it was
    // posted so that a fresh posting beats an equally good older one.
    const titleLower = String(row.title || "").toLowerCase();
    const fitsTarget = roleWords.length > 0 && roleWords.some((w) => titleLower.includes(w));

    // The matcher counts any mention of a skill, so a posting that merely names
    // two of yours (a finance role that mentions SQL) is not enough on its own:
    // they need three of its skills, or two plus a title that fits their target.
    const matchedCount = (match.skillMatch.matchedSkills || []).length;
    if (matchedCount < MIN_MATCHED_SKILLS && !(matchedCount >= 2 && fitsTarget)) continue;

    const value =
      rankValue(match) +
      (fitsTarget ? TARGET_ROLE_BONUS : 0) +
      (!hasLocationPref && looksUS(row.location) ? US_BONUS : 0) -
      (ageMs / DAY_MS) * FRESHNESS_PENALTY_PER_DAY;
    if (!best || value > best.value || (value === best.value && posted > best.posted)) {
      best = { row, match, value, posted };
    }
  }
  if (!best) return null;

  const { row, match } = best;
  return {
    job: {
      id: row.id,
      company: row.company,
      title: row.title,
      url: row.url || null,
      source: row.source || null,
      location: row.location || null,
      remoteType: row.remote_type || null,
      employmentType: row.employment_type || null,
      deadline: row.deadline || null,
      postedAt: row.posted_at,
      description: row.description || null,
    },
    score: match.overallMatchScore,
    matchedSkills: match.skillMatch.matchedSkills || [],
    missingSkills: match.skillMatch.missingSkills || [],
    skillsConsidered: match.skillMatch.totalConsidered || 0,
    daysAgo: Math.max(0, Math.floor((now.getTime() - best.posted) / DAY_MS)),
  };
}

module.exports = { pickNewMatch, looksUS, FRESH_DAYS, MIN_SCORE, MIN_SKILLS };
