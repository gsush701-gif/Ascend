const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Reads a role's free-text deadline as a date in the student's own time zone.
 *
 * `new Date("2026-11-10")` means midnight UTC, which is the evening of Nov 9 in
 * the US, so a deadline picked from the date input showed a day early and went
 * "overdue" on the day it was due. A plain YYYY-MM-DD is read as local midnight
 * instead; anything else (such as "Feb 15") goes through the normal parser.
 * Returns null when the text is not a date.
 */
export function parseDeadline(raw: string | null | undefined): Date | null {
  const text = raw?.trim();
  if (!text) return null;
  const match = DATE_ONLY.exec(text);
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The value for a `<input type="date">` (YYYY-MM-DD) for a deadline, or "" when there is none. */
export function deadlineInputValue(raw: string | null | undefined): string {
  const date = parseDeadline(raw);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
