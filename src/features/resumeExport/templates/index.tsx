import type { ComponentType } from "react";
import type { ResumeStructuredContent } from "../../../types/resume";
import type { ResumeTemplateId } from "../templateRegistry";
import { DEFAULT_RESUME_TEMPLATE_ID } from "../templateRegistry";
import { ClassicTemplate } from "./ClassicTemplate";
import { ModernTemplate } from "./ModernTemplate";
import { TechnicalTemplate } from "./TechnicalTemplate";

export type ResumeTemplateComponent = ComponentType<{ content: ResumeStructuredContent }>;

const TEMPLATE_COMPONENTS: Record<ResumeTemplateId, ResumeTemplateComponent> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  technical: TechnicalTemplate,
};

/** Resolves a template id to its React-PDF document component, falling back to the default template for an unknown id. */
export function getResumeTemplateComponent(templateId: ResumeTemplateId): ResumeTemplateComponent {
  return TEMPLATE_COMPONENTS[templateId] ?? TEMPLATE_COMPONENTS[DEFAULT_RESUME_TEMPLATE_ID];
}
