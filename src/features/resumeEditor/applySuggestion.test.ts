import { describe, it, expect } from "vitest";
import { applySuggestionToContent } from "./applySuggestion";
import { emptyResumeStructuredContent } from "../../types/resume";
import type { ResumeSuggestion } from "../../types/resume";

function makeSuggestion(overrides: Partial<ResumeSuggestion> = {}): Pick<
  ResumeSuggestion,
  "section" | "originalText" | "proposedText"
> {
  return {
    section: overrides.section ?? "summary",
    originalText: overrides.originalText ?? null,
    proposedText: overrides.proposedText ?? "Proposed text",
  };
}

describe("applySuggestionToContent — summary (plain string section)", () => {
  it("replaces the summary when originalText matches it exactly", () => {
    const content = { ...emptyResumeStructuredContent(), summary: "Old summary." };
    const result = applySuggestionToContent(
      content,
      makeSuggestion({ section: "summary", originalText: "Old summary.", proposedText: "New summary." }),
    );
    expect(result.summary).toBe("New summary.");
  });

  it("writes a first-draft summary when originalText is empty and the field is currently empty", () => {
    const content = emptyResumeStructuredContent();
    const result = applySuggestionToContent(
      content,
      makeSuggestion({ section: "summary", originalText: "", proposedText: "Brand new summary." }),
    );
    expect(result.summary).toBe("Brand new summary.");
  });

  it("does not overwrite a non-empty summary when originalText doesn't match it", () => {
    const content = { ...emptyResumeStructuredContent(), summary: "Existing summary." };
    const result = applySuggestionToContent(
      content,
      makeSuggestion({ section: "summary", originalText: "", proposedText: "Something else." }),
    );
    expect(result.summary).toBe("Existing summary.");
  });

  it("does not mutate the original content object", () => {
    const content = { ...emptyResumeStructuredContent(), summary: "Old." };
    applySuggestionToContent(content, makeSuggestion({ section: "summary", originalText: "Old.", proposedText: "New." }));
    expect(content.summary).toBe("Old.");
  });
});

describe("applySuggestionToContent — skills (string array section)", () => {
  it("replaces a matching skill in place", () => {
    const content = { ...emptyResumeStructuredContent(), skills: ["Python", "SQL"] };
    const result = applySuggestionToContent(
      content,
      makeSuggestion({ section: "skills", originalText: "SQL", proposedText: "PostgreSQL" }),
    );
    expect(result.skills).toEqual(["Python", "PostgreSQL"]);
  });

  it("appends a new skill when originalText is empty", () => {
    const content = { ...emptyResumeStructuredContent(), skills: ["Python"] };
    const result = applySuggestionToContent(
      content,
      makeSuggestion({ section: "skills", originalText: "", proposedText: "Docker" }),
    );
    expect(result.skills).toEqual(["Python", "Docker"]);
  });
});

describe("applySuggestionToContent — experience (nested array-of-objects section)", () => {
  it("replaces a matching bullet nested inside an experience entry", () => {
    const content = {
      ...emptyResumeStructuredContent(),
      experience: [
        {
          company: "Acme",
          title: "SWE Intern",
          location: "",
          startDate: "",
          endDate: "",
          bullets: ["Built a thing", "Fixed a bug"],
        },
      ],
    };
    const result = applySuggestionToContent(
      content,
      makeSuggestion({
        section: "experience",
        originalText: "Fixed a bug",
        proposedText: "Fixed a critical production bug, reducing error rate by ~40%",
      }),
    );
    expect(result.experience[0].bullets).toEqual([
      "Built a thing",
      "Fixed a critical production bug, reducing error rate by ~40%",
    ]);
    // Sibling fields/entries untouched.
    expect(result.experience[0].company).toBe("Acme");
  });

  it("replaces only the first matching occurrence when the same text appears twice", () => {
    const content = {
      ...emptyResumeStructuredContent(),
      experience: [
        { company: "A", title: "", location: "", startDate: "", endDate: "", bullets: ["Same bullet"] },
        { company: "B", title: "", location: "", startDate: "", endDate: "", bullets: ["Same bullet"] },
      ],
    };
    const result = applySuggestionToContent(
      content,
      makeSuggestion({ section: "experience", originalText: "Same bullet", proposedText: "Updated bullet" }),
    );
    expect(result.experience[0].bullets).toEqual(["Updated bullet"]);
    expect(result.experience[1].bullets).toEqual(["Same bullet"]);
  });

  it("leaves content unchanged when originalText isn't found anywhere and no empty-field fallback applies", () => {
    const content = {
      ...emptyResumeStructuredContent(),
      experience: [{ company: "Acme", title: "", location: "", startDate: "", endDate: "", bullets: ["Real bullet"] }],
    };
    const result = applySuggestionToContent(
      content,
      makeSuggestion({ section: "experience", originalText: "Text that was never there", proposedText: "New text" }),
    );
    expect(result).toEqual(content);
  });

  it("does not mutate the original content object or its nested entries", () => {
    const content = {
      ...emptyResumeStructuredContent(),
      experience: [{ company: "Acme", title: "", location: "", startDate: "", endDate: "", bullets: ["Original"] }],
    };
    applySuggestionToContent(
      content,
      makeSuggestion({ section: "experience", originalText: "Original", proposedText: "Changed" }),
    );
    expect(content.experience[0].bullets).toEqual(["Original"]);
  });
});

describe("applySuggestionToContent — contact (nested object section)", () => {
  it("replaces a single matching contact field", () => {
    const content = { ...emptyResumeStructuredContent(), contact: { ...emptyResumeStructuredContent().contact, phone: "555-0000" } };
    const result = applySuggestionToContent(
      content,
      makeSuggestion({ section: "contact", originalText: "555-0000", proposedText: "555-1234" }),
    );
    expect(result.contact.phone).toBe("555-1234");
  });
});
