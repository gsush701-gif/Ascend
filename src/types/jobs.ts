// Job Discovery types (Phase 7 Task 8). Mirrors the `jobs` table
// (supabase/migrations/009_jobs.sql) and server/lib/jobProviders/types.js's
// ProviderJob shape — both already use the same field set, just
// snake_case (DB rows) vs. camelCase (provider results); the fields below
// are always the camelCase, frontend-facing form.

export type Job = {
  id: string;
  company: string;
  title: string;
  description?: string;
  url?: string;
  source?: string;
  location?: string;
  remoteType?: string;
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  sponsorship?: string;
  experienceLevel?: string;
  postedAt?: string;
  deadline?: string;
};

/** One sub-score from server/lib/jobMatching.js's computeJobMatch. `score` is
 * null when there wasn't enough data on either side to compare — never a
 * fabricated number. */
export type MatchComponent = {
  score: number | null;
  detail: string;
};

export type SkillMatchComponent = MatchComponent & {
  matchedSkills?: string[];
  missingSkills?: string[];
  totalConsidered?: number;
  usedRequiredOnly?: boolean;
};

/** Full breakdown returned by GET /api/jobs/recommendations for one job —
 * see server/lib/jobMatching.js's computeJobMatch for exactly how each
 * field is derived. */
export type JobMatch = {
  overallMatchScore: number | null;
  skillMatch: SkillMatchComponent;
  locationMatch: MatchComponent;
  sponsorshipMatch: MatchComponent;
  salaryMatch: MatchComponent;
  experienceMatch: MatchComponent;
  whyThisMatches: string[];
};

export type RecommendedJob = Job & { match: JobMatch };

export type SavedJob = Job & { savedAt: string };

/** GET /api/jobs/search response shape (server/lib/jobProviders/types.js's
 * JobSearchResult). `providerConfigured: false` (today, always — see
 * server/lib/jobProviders/index.js) means "search isn't connected to a live
 * listings provider yet", distinct from "zero results matched". */
export type JobSearchResult = {
  jobs: Job[];
  totalCount: number;
  page: number;
  pageSize: number;
  providerConfigured: boolean;
};

export type JobSearchFilters = {
  keywords: string;
  location: string;
  remoteType: string;
  salaryMin: string;
  salaryMax: string;
  sponsorship: string;
  skills: string;
  experienceLevel: string;
  company: string;
  jobType: string;
};

export const EMPTY_JOB_SEARCH_FILTERS: JobSearchFilters = {
  keywords: "",
  location: "",
  remoteType: "",
  salaryMin: "",
  salaryMax: "",
  sponsorship: "",
  skills: "",
  experienceLevel: "",
  company: "",
  jobType: "",
};

export const REMOTE_TYPE_OPTIONS = ["Remote", "Hybrid", "Onsite"];
export const SPONSORSHIP_OPTIONS = ["Yes", "No", "Unknown"];
export const EXPERIENCE_LEVEL_OPTIONS = ["Internship", "Entry", "Mid", "Senior", "Lead", "Executive"];
export const JOB_TYPE_OPTIONS = ["Full-time", "Part-time", "Internship", "Contract", "Temporary"];
