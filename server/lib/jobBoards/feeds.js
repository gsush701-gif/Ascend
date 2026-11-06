// Adapters for the public job boards that companies publish themselves:
// Greenhouse, Lever and Ashby. Each is a read-only, no-key JSON endpoint that
// the vendors expose so a company's postings can be shown elsewhere. Every
// posting we keep links back to the company's own posting page, where the
// student applies; nothing here applies on anyone's behalf.
//
// An adapter knows how to build its URLs and how to turn one raw posting into
// the shape of the `jobs` table. Pure functions apart from `fetchJson`, so they
// are tested against sample payloads (feeds.test.js).

const { classifyEarlyCareer } = require("./earlyCareer");
const { htmlToText, plainText } = require("./text");

const enc = encodeURIComponent;

/** Remote / Hybrid / Onsite from a board's own workplace field, else from the text; undefined if unclear. */
function inferRemoteType({ workplaceType, isRemote, location, title } = {}) {
  const w = typeof workplaceType === "string" ? workplaceType.toLowerCase().replace(/[\s_-]/g, "") : "";
  if (w === "remote") return "Remote";
  if (w === "hybrid") return "Hybrid";
  if (w === "onsite") return "Onsite";
  const text = `${location || ""} ${title || ""}`;
  if (/\bhybrid\b/i.test(text)) return "Hybrid";
  if (/\bremote\b/i.test(text)) return "Remote";
  if (isRemote === true) return "Remote";
  return undefined;
}

function isoOrUndefined(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const d = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function joinLocations(...parts) {
  const seen = new Set();
  for (const p of parts.flat()) {
    if (typeof p === "string" && p.trim()) seen.add(p.trim());
  }
  return seen.size ? [...seen].join(" • ") : undefined;
}

const greenhouse = {
  source: "Greenhouse",
  listUrl: (token) => `https://boards-api.greenhouse.io/v1/boards/${enc(token)}/jobs`,
  /** The full description is only on the per-posting endpoint. */
  detailUrl: (token, job) => `https://boards-api.greenhouse.io/v1/boards/${enc(token)}/jobs/${enc(String(job.id))}`,
  parseList: (data) => (data && Array.isArray(data.jobs) ? data.jobs : null),
  classify: (job) => classifyEarlyCareer({ title: job.title }),
  postedAt: (job) => isoOrUndefined(job.first_published || job.updated_at),
  externalId: (token, job) => `${token}:${job.id}`,
  /**
   * Changes whenever the company edits the posting, so unchanged ones need no
   * re-download. It includes our display name for the company, so correcting a
   * name in the board list re-saves that company's postings on the next run.
   */
  version: (job, board) => (job.updated_at ? `${job.updated_at}|${board.name}` : null),
  toJob(board, job, detail) {
    const level = this.classify(job);
    const location = job.location && job.location.name;
    return {
      externalId: this.externalId(board.token, job),
      boardToken: board.token,
      sourceUpdatedAt: this.version(job, board),
      // Always our curated name: Greenhouse's own company_name is sometimes a
      // legal name ("Gusto, Inc.") or wrong ("Rubrik Job Board").
      company: board.name,
      title: job.title,
      description: htmlToText(detail && detail.content),
      url: job.absolute_url,
      source: this.source,
      location: location || undefined,
      remoteType: inferRemoteType({ location, title: job.title }),
      employmentType: level === "Internship" ? "Internship" : undefined,
      experienceLevel: level,
      postedAt: isoOrUndefined(job.first_published || job.updated_at),
      deadline: isoOrUndefined(job.application_deadline),
    };
  },
};

const lever = {
  source: "Lever",
  listUrl: (token) => `https://api.lever.co/v0/postings/${enc(token)}?mode=json`,
  detailUrl: null,
  parseList: (data) => (Array.isArray(data) ? data : null),
  classify: (job) => classifyEarlyCareer({ title: job.text, employmentType: job.categories && job.categories.commitment }),
  postedAt: (job) => isoOrUndefined(job.createdAt),
  externalId: (token, job) => `${token}:${job.id}`,
  version: () => null,
  toJob(board, job) {
    const level = this.classify(job);
    const cats = job.categories || {};
    const location = joinLocations(cats.allLocations && cats.allLocations.length ? cats.allLocations : cats.location);
    const lists = Array.isArray(job.lists)
      ? job.lists.map((l) => `${l.text || ""}\n${htmlToText(l.content || "")}`).join("\n\n")
      : "";
    const description = plainText([job.descriptionPlain, lists, job.additionalPlain].filter(Boolean).join("\n\n"));
    return {
      externalId: this.externalId(board.token, job),
      boardToken: board.token,
      sourceUpdatedAt: null,
      company: board.name,
      title: job.text,
      description,
      url: job.hostedUrl,
      source: this.source,
      location,
      remoteType: inferRemoteType({ workplaceType: job.workplaceType, location, title: job.text }),
      employmentType: level === "Internship" ? "Internship" : undefined,
      experienceLevel: level,
      postedAt: isoOrUndefined(job.createdAt),
      deadline: undefined,
    };
  },
};

const ashby = {
  source: "Ashby",
  listUrl: (token) => `https://api.ashbyhq.com/posting-api/job-board/${enc(token)}`,
  detailUrl: null,
  parseList: (data) => (data && Array.isArray(data.jobs) ? data.jobs.filter((j) => j.isListed !== false) : null),
  classify: (job) => classifyEarlyCareer({ title: job.title, employmentType: job.employmentType }),
  postedAt: (job) => isoOrUndefined(job.publishedAt),
  externalId: (token, job) => `${token}:${job.id}`,
  version: () => null,
  toJob(board, job) {
    const level = this.classify(job);
    const secondary = Array.isArray(job.secondaryLocations)
      ? job.secondaryLocations.map((l) => (l && l.location) || l)
      : [];
    const location = joinLocations(job.location, secondary);
    return {
      externalId: this.externalId(board.token, job),
      boardToken: board.token,
      sourceUpdatedAt: null,
      company: board.name,
      title: job.title,
      description: plainText(job.descriptionPlain),
      url: job.jobUrl,
      source: this.source,
      location,
      remoteType: inferRemoteType({
        workplaceType: job.workplaceType,
        isRemote: job.isRemote,
        location: job.location,
        title: job.title,
      }),
      employmentType: level === "Internship" ? "Internship" : undefined,
      experienceLevel: level,
      postedAt: isoOrUndefined(job.publishedAt),
      deadline: undefined,
    };
  },
};

const ADAPTERS = { greenhouse, lever, ashby };

const USER_AGENT = "AscendCareers/1.0 (+https://ascendcareers.app)";

/**
 * GETs a URL and parses JSON. One retry after a pause for a network error, a
 * 429 or a 5xx; a 404 (board gone) is thrown straight away with `status` set.
 */
async function fetchJson(url, { timeoutMs = 30000, retries = 1, fetchImpl = fetch } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        signal: ctl.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
      if (res.ok) return await res.json();
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      if (res.status !== 429 && res.status < 500) throw err;
      lastError = err;
    } catch (err) {
      if (err && err.status && err.status !== 429 && err.status < 500) throw err;
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 1500));
  }
  throw lastError;
}

module.exports = { ADAPTERS, fetchJson, inferRemoteType, isoOrUndefined };
