import { API_BASE } from "../../config/api";
import { getApiErrorMessage } from "../../lib/apiError";
import type { Job, JobSearchFilters, JobSearchResult, RecommendedJob, SavedJob } from "../../types/jobs";

// --- Job Discovery API client (Phase 7 Task 8) ---
//
// GET /api/jobs/search is unauthenticated-friendly (optionalAuth) and calls
// whatever provider is active server-side (server/lib/jobProviders/) — today
// always NullJobProvider, so `providerConfigured` comes back false and
// `jobs` empty. GET /api/jobs/recommendations and GET /api/jobs/saved both
// require a real session. Saving/dismissing a job is NOT here — those are
// direct Supabase writes from src/features/jobs/hooks/, matching this app's
// existing pattern for simple owned-row CRUD (see useContacts.ts).

export class JobsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "JobsApiError";
    this.status = status;
  }
}

async function jobsFetch<T>(path: string, accessToken?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new JobsApiError(res.status, getApiErrorMessage(data, "Request failed"));
  }
  return data as T;
}

/** Row shape returned by GET /api/jobs/recommendations / GET /api/jobs/saved
 * for each job — raw `jobs` table columns (snake_case) plus whatever the
 * route adds (`match`, `savedAt`). */
type JobRow = {
  id: string;
  company: string;
  title: string;
  description: string | null;
  url: string | null;
  source: string | null;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  sponsorship: string | null;
  experience_level: string | null;
  posted_at: string | null;
  deadline: string | null;
};

function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    company: row.company,
    title: row.title,
    description: row.description ?? undefined,
    url: row.url ?? undefined,
    source: row.source ?? undefined,
    location: row.location ?? undefined,
    remoteType: row.remote_type ?? undefined,
    employmentType: row.employment_type ?? undefined,
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    salaryCurrency: row.salary_currency ?? undefined,
    sponsorship: row.sponsorship ?? undefined,
    experienceLevel: row.experience_level ?? undefined,
    postedAt: row.posted_at ?? undefined,
    deadline: row.deadline ?? undefined,
  };
}

function buildSearchQuery(filters: Partial<JobSearchFilters>, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  if (filters.keywords?.trim()) params.set("keywords", filters.keywords.trim());
  if (filters.location?.trim()) params.set("location", filters.location.trim());
  if (filters.remoteType) params.set("remoteType", filters.remoteType);
  if (filters.salaryMin) params.set("salaryMin", filters.salaryMin);
  if (filters.salaryMax) params.set("salaryMax", filters.salaryMax);
  if (filters.sponsorship) params.set("sponsorship", filters.sponsorship);
  if (filters.skills?.trim()) params.set("skills", filters.skills.trim());
  if (filters.experienceLevel) params.set("experienceLevel", filters.experienceLevel);
  if (filters.company?.trim()) params.set("company", filters.company.trim());
  if (filters.jobType) params.set("jobType", filters.jobType);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params.toString();
}

export async function searchJobs(
  filters: Partial<JobSearchFilters>,
  page = 1,
  pageSize = 20,
): Promise<JobSearchResult> {
  const query = buildSearchQuery(filters, page, pageSize);
  return jobsFetch<JobSearchResult>(`/api/jobs/search?${query}`);
}

export type JobRecommendationsResult = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: RecommendedJob[];
  hasResumeOnFile: boolean;
};

type JobRecommendationsResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: (JobRow & { match: RecommendedJob["match"] })[];
  hasResumeOnFile: boolean;
};

export async function fetchJobRecommendations(
  accessToken: string,
  page = 1,
  pageSize = 20,
): Promise<JobRecommendationsResult> {
  const data = await jobsFetch<JobRecommendationsResponse>(
    `/api/jobs/recommendations?page=${page}&pageSize=${pageSize}`,
    accessToken,
  );
  return {
    ...data,
    items: data.items.map((row) => ({ ...rowToJob(row), match: row.match })),
  };
}

export async function fetchSavedJobs(accessToken: string): Promise<SavedJob[]> {
  const data = await jobsFetch<{ items: (JobRow & { savedAt: string })[] }>("/api/jobs/saved", accessToken);
  return data.items.map((row) => ({ ...rowToJob(row), savedAt: row.savedAt }));
}
