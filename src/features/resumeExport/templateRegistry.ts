/**
 * Template metadata only (id/label/description) — deliberately has no
 * dependency on `@react-pdf/renderer` or any template component, so pure
 * logic that only needs "which template ids exist" (filename building,
 * selection validation, tests) doesn't pull the PDF renderer into its
 * module graph. The id → component mapping lives in `templates/index.tsx`.
 */
export type ResumeTemplateId = "classic" | "modern" | "technical";

export type ResumeTemplateMeta = {
  id: ResumeTemplateId;
  label: string;
  description: string;
};

export const RESUME_TEMPLATES: ResumeTemplateMeta[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Traditional serif, single column. Safe, conservative default.",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Clean sans-serif with a cyan accent — a bit more visual polish.",
  },
  {
    id: "technical",
    label: "Technical",
    description: "Compact, skills-forward layout for engineering roles.",
  },
];

export const DEFAULT_RESUME_TEMPLATE_ID: ResumeTemplateId = "classic";

export function isResumeTemplateId(value: string | null | undefined): value is ResumeTemplateId {
  return RESUME_TEMPLATES.some((t) => t.id === value);
}
