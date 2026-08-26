import type { TrackerItem } from "../../types/tracker";
import { APPLIED_PLUS_STATUSES, INTERVIEW_PLUS_STATUSES } from "../../lib/dashboardStats";

/** Minimum data points before a rate/breakdown is shown as meaningful,
 * rather than an honest "not enough data yet" state. Matches the product
 * principle (documented across Dashboard/getReadinessScores) against
 * presenting small samples as statistically meaningful. */
export const MIN_SAMPLE_SIZE = 3;

function isApplied(item: TrackerItem): boolean {
  return APPLIED_PLUS_STATUSES.includes(item.status);
}

function reachedInterview(item: TrackerItem): boolean {
  return INTERVIEW_PLUS_STATUSES.includes(item.status);
}

export type CompanyBreakdown = {
  company: string;
  count: number;
  interviewCount: number;
  /** null when there aren't enough applications at this company to make a rate meaningful. */
  interviewRate: number | null;
};

/** Applications sent, grouped by company — which companies get the most
 * applications, and (only where the sample is large enough) their interview
 * rate. Computed purely from the user's own tracked roles. */
export function getApplicationsByCompany(items: TrackerItem[]): CompanyBreakdown[] {
  const applied = items.filter(isApplied);
  const byCompany = new Map<string, TrackerItem[]>();
  for (const item of applied) {
    const key = item.company.trim() || "Unknown company";
    const list = byCompany.get(key) ?? [];
    list.push(item);
    byCompany.set(key, list);
  }
  const rows: CompanyBreakdown[] = [...byCompany.entries()].map(([company, list]) => {
    const interviewCount = list.filter(reachedInterview).length;
    return {
      company,
      count: list.length,
      interviewCount,
      interviewRate: list.length >= MIN_SAMPLE_SIZE ? Math.round((interviewCount / list.length) * 100) : null,
    };
  });
  return rows.sort((a, b) => b.count - a.count);
}

export type SourceBreakdown = {
  source: string;
  count: number;
};

/** Applications sent, grouped by `roles.source` (e.g. "LinkedIn", "referral").
 * Excludes roles with no source set — those aren't a "source" data point,
 * they're missing data. Returns [] when there isn't enough sourced data to
 * be meaningful (roles.source is sparsely populated today). */
export function getApplicationsBySource(items: TrackerItem[]): SourceBreakdown[] {
  const applied = items.filter(isApplied);
  const withSource = applied.filter((i) => i.source && i.source.trim());
  if (withSource.length < MIN_SAMPLE_SIZE) return [];

  const bySource = new Map<string, number>();
  for (const item of withSource) {
    const key = item.source!.trim();
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }
  return [...bySource.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

export type AlignmentBucketBreakdown = {
  bucket: "Low fit (0-49)" | "Medium fit (50-74)" | "High fit (75-100)";
  count: number;
  interviewCount: number;
  interviewRate: number | null;
};

function bucketForAlignment(alignment: number): AlignmentBucketBreakdown["bucket"] {
  if (alignment >= 75) return "High fit (75-100)";
  if (alignment >= 50) return "Medium fit (50-74)";
  return "Low fit (0-49)";
}

/** Applications sent that were actually analyzed (have a reportSnapshot),
 * bucketed by their fit score, with interview rate per bucket where the
 * sample is large enough. Answers "do I get more traction on high-fit
 * applications". Roles never analyzed are excluded — their alignment is a
 * meaningless default 0, not a real "low fit" data point. */
export function getApplicationsByAlignmentBucket(items: TrackerItem[]): AlignmentBucketBreakdown[] {
  const analyzed = items.filter((i) => isApplied(i) && i.reportSnapshot);
  const buckets: Record<AlignmentBucketBreakdown["bucket"], TrackerItem[]> = {
    "Low fit (0-49)": [],
    "Medium fit (50-74)": [],
    "High fit (75-100)": [],
  };
  for (const item of analyzed) {
    const alignment = item.reportSnapshot?.alignment ?? item.alignment;
    buckets[bucketForAlignment(alignment)].push(item);
  }
  return (Object.keys(buckets) as AlignmentBucketBreakdown["bucket"][]).map((bucket) => {
    const list = buckets[bucket];
    const interviewCount = list.filter(reachedInterview).length;
    return {
      bucket,
      count: list.length,
      interviewCount,
      interviewRate: list.length >= MIN_SAMPLE_SIZE ? Math.round((interviewCount / list.length) * 100) : null,
    };
  });
}

export type ResumeVersionBreakdown = {
  resumeId: string;
  resumeName: string;
  count: number;
  interviewCount: number;
  interviewRate: number | null;
};

/** Applications sent, grouped by which saved resume was used (`roles.resume_id`).
 * Excludes roles with no resume_id set. Returns [] when there isn't enough
 * data to be meaningful (this field is sparsely populated today). */
export function getApplicationsByResumeVersion(
  items: TrackerItem[],
  resumeNameById: Map<string, string>
): ResumeVersionBreakdown[] {
  const applied = items.filter(isApplied);
  const withResume = applied.filter((i) => i.resumeId);
  if (withResume.length < MIN_SAMPLE_SIZE) return [];

  const byResume = new Map<string, TrackerItem[]>();
  for (const item of withResume) {
    const key = item.resumeId!;
    const list = byResume.get(key) ?? [];
    list.push(item);
    byResume.set(key, list);
  }
  const rows: ResumeVersionBreakdown[] = [...byResume.entries()].map(([resumeId, list]) => {
    const interviewCount = list.filter(reachedInterview).length;
    return {
      resumeId,
      resumeName: resumeNameById.get(resumeId) ?? "Deleted/unknown resume",
      count: list.length,
      interviewCount,
      interviewRate: list.length >= MIN_SAMPLE_SIZE ? Math.round((interviewCount / list.length) * 100) : null,
    };
  });
  return rows.sort((a, b) => b.count - a.count);
}
