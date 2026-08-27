import { describe, it, expect } from "vitest";
import { RESUME_TEMPLATES, DEFAULT_RESUME_TEMPLATE_ID, isResumeTemplateId } from "./templateRegistry";

describe("templateRegistry", () => {
  it("lists at least three distinct templates, each with an id/label/description", () => {
    expect(RESUME_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    const ids = RESUME_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of RESUME_TEMPLATES) {
      expect(t.label.trim().length).toBeGreaterThan(0);
      expect(t.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("has a default template id that is itself a valid template id", () => {
    expect(isResumeTemplateId(DEFAULT_RESUME_TEMPLATE_ID)).toBe(true);
  });

  it("isResumeTemplateId accepts every registered id and rejects unknown/empty values", () => {
    for (const t of RESUME_TEMPLATES) {
      expect(isResumeTemplateId(t.id)).toBe(true);
    }
    expect(isResumeTemplateId("fancy")).toBe(false);
    expect(isResumeTemplateId(null)).toBe(false);
    expect(isResumeTemplateId(undefined)).toBe(false);
    expect(isResumeTemplateId("")).toBe(false);
  });
});
