import type { TrackerItem } from "../../types/tracker";
import type { ProfileData } from "../../lib/profile";

export type CompatibilityNote = {
  text: string;
  /** "match" (green), "mismatch" (amber — worth a second look, never an error), or "info" (neutral, unknown data). */
  tone: "match" | "mismatch" | "info";
};

function locationsMatch(preferred: string, jobLocation: string): boolean {
  const jobLower = jobLocation.trim().toLowerCase();
  if (!jobLower) return false;
  return preferred
    .split(/[;,]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((pref) => jobLower.includes(pref) || pref.includes(jobLower));
}

/**
 * Simple, honest textual comparisons between a role's own employer-stated
 * fields (sponsorship/location/remote_type — Phase 2b) and the user's own
 * stated preferences (Phase 5 profile fields). Deliberately NOT a numeric
 * "compatibility score" with false precision — just plain pattern-matching
 * on two pieces of already-visible text, and never immigration/legal
 * advice. Returns [] when there's nothing on both sides to compare.
 */
export function getCompatibilityNotes(item: TrackerItem, profile: ProfileData): CompatibilityNote[] {
  const notes: CompatibilityNote[] = [];

  if (profile.requiresSponsorship === true && item.sponsorship) {
    if (item.sponsorship === "No") {
      notes.push({
        text: "This employer has indicated they do not sponsor work visas — your profile says you require sponsorship. Worth confirming directly with the employer before investing more time.",
        tone: "mismatch",
      });
    } else if (item.sponsorship === "Unknown") {
      notes.push({
        text: "This employer's sponsorship policy isn't marked — you've indicated you require sponsorship, so it's worth confirming directly.",
        tone: "info",
      });
    } else if (item.sponsorship === "Yes") {
      notes.push({
        text: "This employer has indicated they sponsor work visas — matches your stated need for sponsorship.",
        tone: "match",
      });
    }
  }

  const hasRemotePref = profile.remotePreference && profile.remotePreference !== "No preference";
  if (hasRemotePref && item.remoteType) {
    if (item.remoteType === profile.remotePreference) {
      notes.push({
        text: `Remote type (${item.remoteType}) matches your preference.`,
        tone: "match",
      });
    } else {
      notes.push({
        text: `Remote type: ${item.remoteType} — your preference is ${profile.remotePreference}. Low match on this criterion.`,
        tone: "mismatch",
      });
    }
  }

  if (profile.preferredLocations && item.location) {
    if (locationsMatch(profile.preferredLocations, item.location)) {
      notes.push({
        text: `Location (${item.location}) matches one of your preferred locations.`,
        tone: "match",
      });
    } else {
      notes.push({
        text: `Location: ${item.location} — your preferences are "${profile.preferredLocations}". Doesn't look like a match, but double-check the exact details.`,
        tone: "mismatch",
      });
    }
  }

  return notes;
}
