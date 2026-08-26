import type { TrackerItem } from "../../types/tracker";

export type DuplicateCandidate = {
  company: string;
  role: string;
  /** Job posting URL, if known at the time of the check. */
  jobUrl?: string;
};

export type DuplicateMatch = {
  item: TrackerItem;
  /** 0-100 "how confident is this a duplicate" score, for display only. */
  matchScore: number;
};

/** Case-insensitive, whitespace-collapsed normalization for company/role comparison. */
export function normalizeForDedup(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Light URL normalization: trim, lowercase, strip trailing slash(es). Not a
 * full URL-equivalence check (doesn't ignore query params, www., etc.) —
 * deliberately conservative so it only flags URLs that are effectively
 * identical, per the "same job_url if provided" spec. */
function normalizeUrlForDedup(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
}

/**
 * Finds an existing tracked role that looks like a duplicate of `candidate`:
 * same normalized company AND (same normalized role title OR same job URL).
 * Returns the single best match (highest score) or null if nothing matches.
 *
 * This is intentionally a soft check, not a hard block — two different
 * postings at the same company can share a similar title, so callers should
 * warn and let the user proceed rather than refuse the add outright.
 */
export function findDuplicateRole(
  existing: TrackerItem[],
  candidate: DuplicateCandidate
): DuplicateMatch | null {
  const candCompany = normalizeForDedup(candidate.company);
  if (!candCompany) return null;
  const candRole = normalizeForDedup(candidate.role);
  const candUrl = normalizeUrlForDedup(candidate.jobUrl);

  let best: DuplicateMatch | null = null;
  for (const item of existing) {
    if (normalizeForDedup(item.company) !== candCompany) continue;

    const sameTitle = candRole !== "" && normalizeForDedup(item.role) === candRole;
    const itemUrl = normalizeUrlForDedup(item.jobUrl);
    const sameUrl = candUrl !== "" && itemUrl !== "" && itemUrl === candUrl;

    if (!sameTitle && !sameUrl) continue;

    const matchScore = sameTitle && sameUrl ? 100 : sameUrl ? 95 : 90;
    if (!best || matchScore > best.matchScore) {
      best = { item, matchScore };
    }
  }
  return best;
}

/** Human-readable warning matching the product's requested phrasing:
 * "You already tracked this job. [Company] [Role], added [date], match score [X]%" */
export function formatDuplicateWarning(match: DuplicateMatch): string {
  const { item, matchScore } = match;
  const addedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `You already tracked this job. ${item.company} ${item.role}, added ${addedDate}, match score ${matchScore}%.`;
}
