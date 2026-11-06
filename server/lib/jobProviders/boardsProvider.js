// Job search over the company-board feed. The daily sync
// (server/lib/jobBoards/sync.js) copies internship and new-grad postings from
// companies' own public boards into the `jobs` table; this provider searches
// that table. Search therefore never calls a company's board live, so it is
// fast and does not depend on anyone's rate limits.
//
// Follows the JobProvider contract in ./types.js: `search` never throws and
// never fabricates a posting.

const { supabaseAdmin } = require("../supabaseAdmin");

const DEFAULT_PAGE_SIZE = 20;
const MAX_TERMS = 6;
const MAX_SKILLS = 20;
const DESCRIPTION_PREVIEW = 1500;

const COLUMNS =
  "id, company, title, description, url, source, location, remote_type, employment_type, experience_level, posted_at, deadline";

/**
 * A search word made safe to drop into a PostgREST filter: those characters
 * (commas, parentheses, wildcards, quotes) are part of the filter syntax.
 */
function cleanTerm(raw) {
  return String(raw || "")
    .replace(/[,()%*\\:"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function splitTerms(text) {
  return cleanTerm(text)
    .split(" ")
    .filter(Boolean)
    .slice(0, MAX_TERMS);
}

function normalizePage(v) {
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 1;
}

function normalizePageSize(v) {
  return Number.isFinite(v) && v > 0 ? Math.min(Math.floor(v), 50) : DEFAULT_PAGE_SIZE;
}

function rowToJob(row) {
  return {
    id: row.id,
    company: row.company,
    title: row.title,
    description: row.description ? row.description.slice(0, DESCRIPTION_PREVIEW) : undefined,
    url: row.url || undefined,
    source: row.source || undefined,
    location: row.location || undefined,
    remoteType: row.remote_type || undefined,
    employmentType: row.employment_type || undefined,
    experienceLevel: row.experience_level || undefined,
    postedAt: row.posted_at || undefined,
    deadline: row.deadline || undefined,
  };
}

/** @type {import('./types').JobProvider} */
const BoardsJobProvider = {
  isConfigured: Boolean(supabaseAdmin),

  async search(params = {}) {
    const page = normalizePage(params.page);
    const pageSize = normalizePageSize(params.pageSize);
    const empty = (providerConfigured) => ({ jobs: [], totalCount: 0, page, pageSize, providerConfigured });

    if (!supabaseAdmin) return empty(false);

    try {
      let q = supabaseAdmin.from("jobs").select(COLUMNS, { count: "exact" }).eq("active", true);

      // Every keyword must appear somewhere in the title, company or description.
      for (const term of splitTerms(params.keywords)) {
        q = q.or(`title.ilike.%${term}%,company.ilike.%${term}%,description.ilike.%${term}%`);
      }
      const location = cleanTerm(params.location);
      if (location) q = q.ilike("location", `%${location}%`);
      const company = cleanTerm(params.company);
      if (company) q = q.ilike("company", `%${company}%`);
      if (params.remoteType) q = q.eq("remote_type", cleanTerm(params.remoteType));

      // "Internship" lives in employment_type; "Entry" in experience_level. Accept either.
      for (const kind of [params.jobType, params.experienceLevel]) {
        const t = cleanTerm(kind);
        if (t) q = q.or(`employment_type.ilike.%${t}%,experience_level.ilike.%${t}%`);
      }

      // Any one of the skills appearing in the title or description.
      const skills = (Array.isArray(params.skills) ? params.skills : [])
        .map(cleanTerm)
        .filter(Boolean)
        .slice(0, MAX_SKILLS);
      if (skills.length) {
        q = q.or(skills.map((s) => `title.ilike.%${s}%,description.ilike.%${s}%`).join(","));
      }

      // Postings from these boards carry no salary or sponsorship data, so those
      // filters are not applied rather than silently hiding every result.

      const from = (page - 1) * pageSize;
      const { data, error, count } = await q
        .order("posted_at", { ascending: false, nullsFirst: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;

      return {
        jobs: (data || []).map(rowToJob),
        totalCount: typeof count === "number" ? count : (data || []).length,
        page,
        pageSize,
        providerConfigured: true,
      };
    } catch (err) {
      console.error("[boardsProvider] search failed:", err && err.message ? err.message : err);
      return empty(false);
    }
  },
};

module.exports = { BoardsJobProvider, cleanTerm, splitTerms, rowToJob };
