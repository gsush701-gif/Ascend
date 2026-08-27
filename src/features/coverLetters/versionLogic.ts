// Pure, testable rules for cover letter version numbering and active-version
// promotion. Kept free of Supabase/React so they can be unit tested directly
// — see versionLogic.test.ts. The stateful wiring (fetching, retrying on a
// unique-constraint race, writing) lives in
// src/features/coverLetters/hooks/useCoverLetterVersions.ts.

/**
 * The next version number for a role, given the version numbers of its
 * existing (non-deleted) versions. Starts at 1 for a role with none yet.
 */
export function nextVersionNumber(existingVersionNumbers: number[]): number {
  if (existingVersionNumbers.length === 0) return 1;
  return Math.max(...existingVersionNumbers) + 1;
}

/** Default display name for a version the user didn't name themselves. */
export function defaultVersionName(versionNumber: number): string {
  return `Version ${versionNumber}`;
}

/** The name actually shown for a version — its own name, or the default. */
export function resolveDisplayName(
  name: string | null | undefined,
  versionNumber: number,
): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : defaultVersionName(versionNumber);
}

/** Name assigned to a freshly duplicated version. */
export function duplicateVersionName(
  originalName: string | null | undefined,
  originalVersionNumber: number,
): string {
  return `Copy of ${resolveDisplayName(originalName, originalVersionNumber)}`;
}

type PromotionCandidate = {
  id: string;
  versionNumber: number;
  updatedAt: string;
};

/**
 * When the active version of a role is deleted, which of the remaining
 * versions (if any) should become active instead? "Most recent" is defined
 * primarily by version number (higher = newer), with `updatedAt` as a
 * tiebreaker — version numbers are already monotonically increasing per
 * role, so a tie should only happen with malformed/legacy data.
 *
 * Returns null when no versions remain (a role may legitimately end up with
 * zero versions and rely solely on the legacy `roles.cover_letter` mirror).
 */
export function pickPromotedVersion<T extends PromotionCandidate>(
  remainingVersions: T[],
): T | null {
  if (remainingVersions.length === 0) return null;
  return [...remainingVersions].sort((a, b) => {
    if (b.versionNumber !== a.versionNumber) return b.versionNumber - a.versionNumber;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  })[0];
}
