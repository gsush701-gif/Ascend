import type { ResumeStructuredContent, ResumeSuggestion } from "../../types/resume";

/**
 * Recursively search `value` for a string strictly equal to `originalText`
 * and replace the first occurrence (depth-first, array-then-object key
 * order — a stable, deterministic traversal) with `proposedText`. Returns
 * the value unchanged (same reference) when nothing matched, plus whether a
 * replacement happened, so callers can fall back instead of silently
 * no-op-ing.
 */
function replaceFirstMatch(
  value: unknown,
  originalText: string,
  proposedText: string,
): { value: unknown; replaced: boolean } {
  if (typeof value === "string") {
    if (originalText.length > 0 && value === originalText) {
      return { value: proposedText, replaced: true };
    }
    return { value, replaced: false };
  }
  if (Array.isArray(value)) {
    let replaced = false;
    const next = value.map((item) => {
      if (replaced) return item;
      const result = replaceFirstMatch(item, originalText, proposedText);
      if (result.replaced) replaced = true;
      return result.value;
    });
    return replaced ? { value: next, replaced: true } : { value, replaced: false };
  }
  if (value && typeof value === "object") {
    let replaced = false;
    const next: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const key of Object.keys(next)) {
      if (replaced) break;
      const result = replaceFirstMatch(next[key], originalText, proposedText);
      if (result.replaced) {
        next[key] = result.value;
        replaced = true;
      }
    }
    return replaced ? { value: next, replaced: true } : { value, replaced: false };
  }
  return { value, replaced: false };
}

/**
 * Apply one AI suggestion (server/lib/groq.js's `generateResumeSuggestions`
 * output, persisted to `resume_suggestions`) into a candidate's editable
 * structured resume content, returning a new object — never mutates
 * `content`. `textOverride` lets the caller apply an edited version of the
 * proposed text instead of the suggestion's own `proposedText` (the
 * editor's "edit before accept" flow).
 *
 * Behavior:
 * - If `suggestion.originalText` is found verbatim somewhere inside the
 *   target section, that occurrence is replaced with the (possibly
 *   overridden) proposed text.
 * - If `originalText` is empty (the suggestion proposes genuinely new
 *   content — e.g. a first-draft summary, or an additional skill) and the
 *   section is `summary` or `skills`, the text is written in / appended
 *   rather than searched for.
 * - Otherwise (no match found, and no safe empty-field fallback applies),
 *   the content is returned unchanged rather than guessing which entry to
 *   edit.
 */
export function applySuggestionToContent(
  content: ResumeStructuredContent,
  suggestion: Pick<ResumeSuggestion, "section" | "originalText" | "proposedText">,
  textOverride?: string,
): ResumeStructuredContent {
  const proposedText = textOverride ?? suggestion.proposedText;
  const originalText = suggestion.originalText ?? "";
  const section = suggestion.section;
  const sectionValue = content[section];

  const { value: nextSectionValue, replaced } = replaceFirstMatch(sectionValue, originalText, proposedText);
  if (replaced) {
    return { ...content, [section]: nextSectionValue } as ResumeStructuredContent;
  }

  if (originalText.length === 0) {
    if (section === "summary" && !content.summary.trim()) {
      return { ...content, summary: proposedText };
    }
    if (section === "skills") {
      return { ...content, skills: [...content.skills, proposedText] };
    }
  }

  return content;
}
