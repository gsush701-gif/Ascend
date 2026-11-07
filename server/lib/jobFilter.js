// Filters a list of open postings (rows from the `jobs` table) the way the Jobs
// page's filter card asks for: words, place, level, work style, company, skills.
//
// The public search (server/lib/jobProviders/boardsProvider.js) does the same
// filtering inside the database. Recommendations are scored in memory from a
// shared copy of the open postings (server/lib/jobFeedCache.js), so they filter
// in memory too, using the same meaning for each field:
//   - keywords: every word must appear in the title, company or description;
//   - location: a part of the posting's location text;
//   - company: a part of the company name;
//   - work style: exact (Remote, Hybrid or Onsite);
//   - level: matches the posting's level or its employment type;
//   - skills: any one of them appears in the title or description.
//
// Pure, so it is unit-tested (jobFilter.test.js).

const MAX_TERMS = 6;
const MAX_SKILLS = 20;
const MAX_LEN = 60;

const lower = (s) => String(s || "").toLowerCase();

function terms(text) {
  return lower(text)
    .split(/[\s,]+/)
    .map((t) => t.trim().slice(0, MAX_LEN))
    .filter(Boolean)
    .slice(0, MAX_TERMS);
}

function skillList(skills) {
  const list = Array.isArray(skills) ? skills : typeof skills === "string" ? skills.split(",") : [];
  return list
    .map((s) => lower(s).trim().slice(0, MAX_LEN))
    .filter(Boolean)
    .slice(0, MAX_SKILLS);
}

/**
 * Turns a request's query string into the filter object, ignoring anything that
 * is not a short string.
 *
 * @param {Record<string, unknown>} query
 */
function parseJobFilters(query) {
  const q = query || {};
  const str = (v) => (typeof v === "string" ? v.trim().slice(0, 200) : "");
  return {
    keywords: str(q.keywords),
    location: str(q.location),
    company: str(q.company),
    remoteType: ["Remote", "Hybrid", "Onsite"].includes(q.remoteType) ? q.remoteType : "",
    experienceLevel: ["Internship", "Entry"].includes(q.experienceLevel) ? q.experienceLevel : "",
    skills: str(q.skills),
  };
}

/** True when the filters would not remove anything. */
function isEmptyFilter(f) {
  return !f || (!f.keywords && !f.location && !f.company && !f.remoteType && !f.experienceLevel && !f.skills);
}

/**
 * @param {Array<object>} rows `jobs` rows
 * @param {ReturnType<typeof parseJobFilters>} filters
 */
function filterJobRows(rows, filters) {
  if (isEmptyFilter(filters)) return rows;
  const words = terms(filters.keywords);
  const place = lower(filters.location).trim();
  const company = lower(filters.company).trim();
  const level = lower(filters.experienceLevel).trim();
  const skills = skillList(filters.skills);

  return rows.filter((r) => {
    if (words.length > 0) {
      const text = lower(`${r.title} ${r.company} ${r.description}`);
      if (!words.every((w) => text.includes(w))) return false;
    }
    if (place && !lower(r.location).includes(place)) return false;
    if (company && !lower(r.company).includes(company)) return false;
    if (filters.remoteType && r.remote_type !== filters.remoteType) return false;
    if (level && !(lower(r.experience_level).includes(level) || lower(r.employment_type).includes(level))) {
      return false;
    }
    if (skills.length > 0) {
      const text = lower(`${r.title} ${r.description}`);
      if (!skills.some((s) => text.includes(s))) return false;
    }
    return true;
  });
}

module.exports = { filterJobRows, parseJobFilters, isEmptyFilter };
