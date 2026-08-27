import { describe, it, expect } from "vitest";
import { emptyResumeStructuredContent } from "../../types/resume";
import type { ResumeStructuredContent } from "../../types/resume";
import { prepareResumeSections, formatContactLine, formatDateRange } from "./sectionData";

function makeContent(overrides: Partial<ResumeStructuredContent> = {}): ResumeStructuredContent {
  return { ...emptyResumeStructuredContent(), ...overrides };
}

describe("prepareResumeSections — empty content", () => {
  it("marks everything absent for a freshly-created empty structured_content", () => {
    const s = prepareResumeSections(emptyResumeStructuredContent());
    expect(s.isEmpty).toBe(true);
    expect(s.hasContact).toBe(false);
    expect(s.hasSummary).toBe(false);
    expect(s.hasEducation).toBe(false);
    expect(s.hasExperience).toBe(false);
    expect(s.hasProjects).toBe(false);
    expect(s.hasSkills).toBe(false);
    expect(s.hasCertifications).toBe(false);
    expect(s.hasAwards).toBe(false);
  });
});

describe("prepareResumeSections — dropping blank scaffold entries", () => {
  it("drops an education entry that was added but never filled in", () => {
    const content = makeContent({
      education: [
        { school: "", degree: "", field: "", startDate: "", endDate: "", gpa: "" },
        { school: "MIT", degree: "BS", field: "CS", startDate: "2018", endDate: "2022", gpa: "" },
      ],
    });
    const s = prepareResumeSections(content);
    expect(s.hasEducation).toBe(true);
    expect(s.education).toHaveLength(1);
    expect(s.education[0].school).toBe("MIT");
  });

  it("drops an experience entry with no company/title, and trims blank bullets from a kept entry", () => {
    const content = makeContent({
      experience: [
        { company: "", title: "", location: "", startDate: "", endDate: "", bullets: ["should be dropped too"] },
        {
          company: "Acme",
          title: "Engineer",
          location: "Remote",
          startDate: "2020",
          endDate: "2023",
          bullets: ["Did a thing", "  ", "", "Did another thing"],
        },
      ],
    });
    const s = prepareResumeSections(content);
    expect(s.hasExperience).toBe(true);
    expect(s.experience).toHaveLength(1);
    expect(s.experience[0].bullets).toEqual(["Did a thing", "Did another thing"]);
  });

  it("drops project/certification/award entries with no name", () => {
    const content = makeContent({
      projects: [{ name: "", description: "", technologies: [], bullets: [] }],
      certifications: [{ name: "", issuer: "Some Org", date: "2021" }],
      awards: [{ name: "", issuer: "Some Org", date: "2021" }],
    });
    const s = prepareResumeSections(content);
    expect(s.hasProjects).toBe(false);
    expect(s.hasCertifications).toBe(false);
    expect(s.hasAwards).toBe(false);
  });

  it("filters blank strings out of the skills list", () => {
    const content = makeContent({ skills: ["Python", "  ", "", "Go"] });
    const s = prepareResumeSections(content);
    expect(s.skills).toEqual(["Python", "Go"]);
  });

  it("treats a contact block with only whitespace fields as absent", () => {
    const content = makeContent({
      contact: { name: "  ", email: "", phone: "", location: "", linkedin: "", portfolio: "" },
    });
    const s = prepareResumeSections(content);
    expect(s.hasContact).toBe(false);
  });

  it("treats a contact block with at least one real field as present", () => {
    const content = makeContent({
      contact: { name: "", email: "jane@example.com", phone: "", location: "", linkedin: "", portfolio: "" },
    });
    const s = prepareResumeSections(content);
    expect(s.hasContact).toBe(true);
  });
});

describe("formatContactLine", () => {
  it("joins only the non-empty contact fields", () => {
    const line = formatContactLine({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "",
      location: "Austin, TX",
      linkedin: "",
      portfolio: "janedoe.dev",
    });
    expect(line).toBe("Austin, TX  •  jane@example.com  •  janedoe.dev");
  });

  it("returns an empty string when nothing but the name is filled in", () => {
    const line = formatContactLine({
      name: "Jane Doe",
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      portfolio: "",
    });
    expect(line).toBe("");
  });
});

describe("formatDateRange", () => {
  it("joins start and end with an en dash", () => {
    expect(formatDateRange("2020", "2023")).toBe("2020 – 2023");
  });
  it("falls back to just the start date when end is blank (current role)", () => {
    expect(formatDateRange("2020", "")).toBe("2020");
  });
  it("falls back to just the end date when start is blank", () => {
    expect(formatDateRange("", "2023")).toBe("2023");
  });
  it("returns an empty string when both are blank", () => {
    expect(formatDateRange("", "")).toBe("");
  });
});
