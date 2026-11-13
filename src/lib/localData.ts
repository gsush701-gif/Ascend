/**
 * What Ascend keeps in this browser about the person using it, and how it is
 * removed. Students often use shared computers (a lab, a library), so nothing
 * personal may outlive a sign-out or be shown to the next person who signs in.
 *
 * Add any new browser-storage key that holds something about a student here.
 */

/** Keys holding one student's content or history. */
const PERSONAL_KEYS = [
  // Resume Lab: the bullets a student pasted and the rewrites they got back.
  "internos_resume_lab_history_v1",
  // Analyzer: past fit scores, and the file name of the last resume (usually a full name).
  "internos_alignment_history_v1",
  "internos_last_resume_v1",
  // An early version of the tracker kept roles here.
  "internos_tracker_v1",
  // Kairos: this week's plan and the items dismissed from it.
  "ascend.advisor.plan",
  "ascend.advisor.dismissed",
];
// Not listed on purpose: the onboarding flags (three true/false values) and the
// roles sort order. They say nothing about a person, and clearing them would
// bring the getting-started checklist back on every sign-in.

/** Key prefixes, for data saved once per account. */
const PERSONAL_PREFIXES = ["ascend.kairos.thread."];

/** Which account the personal data in this browser belongs to. */
const OWNER_KEY = "ascend.owner";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Removes everything personal that Ascend saved in this browser. Called on
 * sign-out and when the session ends for any other reason. Display choices
 * that say nothing about a person (how the roles list is sorted) are left.
 */
export function clearPersonalData(storage: StorageLike | null = browserStorage()): void {
  if (!storage) return;
  try {
    for (const key of PERSONAL_KEYS) storage.removeItem(key);
    const prefixed: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && PERSONAL_PREFIXES.some((p) => key.startsWith(p))) prefixed.push(key);
    }
    for (const key of prefixed) storage.removeItem(key);
    storage.removeItem(OWNER_KEY);
  } catch {
    // Storage unavailable: nothing was saved there.
  }
}

/**
 * Called when a session starts. If the personal data in this browser was left
 * by someone else, or by an anonymous visitor before anyone signed in, it is
 * removed before the new person sees any page that reads it. This covers the
 * case sign-out cannot: a session that expired, or a browser that was closed
 * without signing out. Returns true when something was cleared.
 */
export function claimPersonalData(userId: string, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    if (storage.getItem(OWNER_KEY) === userId) return false;
    clearPersonalData(storage);
    storage.setItem(OWNER_KEY, userId);
    return true;
  } catch {
    return false;
  }
}
