// "Add this to my resume" support for POST /analyze. The user writes bullets in
// the Analyzer and re-checks their score with those lines counted, without
// having to re-export a PDF first. Pure helpers so the limits are unit-tested.

const MAX_ADDITION_LINES = 15;
const MIN_LINE_LENGTH = 10;
const MAX_LINE_LENGTH = 300;

/**
 * Turns the raw `additions` form field (newline-separated bullets) into a
 * clean list: trimmed, bullet markers stripped, too-short lines dropped, each
 * line and the list itself capped. Anything that isn't a string yields [].
 *
 * @param {unknown} raw
 * @returns {string[]}
 */
function parseAdditions(raw) {
  if (typeof raw !== "string") return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-•*]\s*/, ""))
    .filter((line) => line.length >= MIN_LINE_LENGTH)
    .slice(0, MAX_ADDITION_LINES)
    .map((line) => line.slice(0, MAX_LINE_LENGTH));
}

/** Appends the additions to the resume text for scoring only (never stored). */
function applyAdditions(resumeText, additions) {
  if (!additions || additions.length === 0) return resumeText;
  return `${resumeText}\n${additions.map((line) => `• ${line}`).join("\n")}`;
}

module.exports = { parseAdditions, applyAdditions, MAX_ADDITION_LINES, MAX_LINE_LENGTH };
