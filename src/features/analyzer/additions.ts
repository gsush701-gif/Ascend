// Pure helpers for the Analyzer's "add this to my resume" flow: the user writes
// a real bullet for a missing skill, adds it to a list, and re-checks the score
// with those lines counted. Kept free of React so the rules are unit-tested.

export type ResumeAddition = { skill: string; text: string };

/** Shortest bullet worth counting; matches the server's own minimum line length. */
export const MIN_ADDITION_LENGTH = 20;

/** What the editor starts with — a stem, deliberately NOT a finished claim with
 *  invented numbers, so the user has to say what they actually did. */
export function starterFor(skill: string): string {
  return `Used ${skill} to `;
}

/**
 * Returns a message explaining why `text` can't be added for `skill`, or null
 * when it's fine. Rules: a real sentence, it actually mentions the skill (so it
 * counts toward the match), and no leftover template placeholders.
 */
export function validateAddition(skill: string, text: string): string | null {
  const t = text.trim();
  if (t.length < MIN_ADDITION_LENGTH) return "Write a full bullet describing what you did.";
  if (!t.toLowerCase().includes(skill.trim().toLowerCase())) return `Mention ${skill} in the bullet so it counts.`;
  if (/\[[^\]]*\]|\bX{2,}\b|\b(lorem|ipsum)\b/i.test(t)) return "Replace the placeholder with your real details.";
  // Just the starter stem with nothing after it.
  if (t.toLowerCase() === starterFor(skill).trim().toLowerCase()) return "Finish the sentence with what you actually did.";
  return null;
}

/** Adds an addition, replacing an earlier one for the same skill (one bullet per skill). */
export function upsertAddition(list: ResumeAddition[], next: ResumeAddition): ResumeAddition[] {
  const key = next.skill.trim().toLowerCase();
  return [...list.filter((a) => a.skill.trim().toLowerCase() !== key), { skill: next.skill, text: next.text.trim() }];
}

/** Plain-text bullets, for copying into a real resume or downloading. */
export function additionsToText(list: ResumeAddition[]): string {
  return list.map((a) => `• ${a.text.trim()}`).join("\n");
}
