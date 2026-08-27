import type { ResumeTemplateId } from "./templateRegistry";
import { RESUME_TEMPLATES } from "./templateRegistry";

/**
 * Builds a filesystem-safe download filename for an exported resume PDF,
 * e.g. "Jane_Doe_Resume_Modern.pdf". Pure so it's unit-testable without
 * touching the DOM/Blob APIs used by the actual download trigger.
 */
export function buildResumeExportFilename(resumeName: string | null | undefined, templateId: ResumeTemplateId): string {
  const base = (resumeName ?? "").trim() || "Resume";
  const templateLabel = RESUME_TEMPLATES.find((t) => t.id === templateId)?.label ?? templateId;
  const safeBase = base.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Resume";
  const safeTemplate = templateLabel.replace(/[^a-zA-Z0-9]+/g, "_");
  return `${safeBase}_${safeTemplate}.pdf`;
}
