import type {
  ResumeAwardEntry,
  ResumeCertificationEntry,
  ResumeContact,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeProjectEntry,
  ResumeStructuredContent,
} from "../../types/resume";

/**
 * Pure data-preparation layer shared by every PDF template
 * (src/features/resumeExport/templates/*). One place decides what counts as
 * "this section has real content" so every template renders sections
 * identically (no template independently reinvents "is this entry empty?"
 * logic, and no template shows an empty heading for a section the user never
 * filled in).
 */

const isFilled = (value: string | null | undefined): boolean => Boolean(value && value.trim().length > 0);

/** An education entry counts as real content once the user has named the school or degree. */
export function isEducationEntryFilled(entry: ResumeEducationEntry): boolean {
  return isFilled(entry.school) || isFilled(entry.degree) || isFilled(entry.field);
}

/** An experience entry counts as real content once the user has named the company or title. */
export function isExperienceEntryFilled(entry: ResumeExperienceEntry): boolean {
  return isFilled(entry.company) || isFilled(entry.title);
}

/** A project entry counts as real content once it has a name or description. */
export function isProjectEntryFilled(entry: ResumeProjectEntry): boolean {
  return isFilled(entry.name) || isFilled(entry.description);
}

/** A certification/award entry counts as real content once it has a name. */
export function isNamedEntryFilled(entry: ResumeCertificationEntry | ResumeAwardEntry): boolean {
  return isFilled(entry.name);
}

export type PreparedEducationEntry = ResumeEducationEntry;
export type PreparedExperienceEntry = ResumeExperienceEntry & { bullets: string[] };
export type PreparedProjectEntry = ResumeProjectEntry & { bullets: string[]; technologies: string[] };

export type PreparedResumeSections = {
  contact: ResumeContact;
  hasContact: boolean;
  summary: string;
  hasSummary: boolean;
  education: PreparedEducationEntry[];
  hasEducation: boolean;
  experience: PreparedExperienceEntry[];
  hasExperience: boolean;
  projects: PreparedProjectEntry[];
  hasProjects: boolean;
  skills: string[];
  hasSkills: boolean;
  certifications: ResumeCertificationEntry[];
  hasCertifications: boolean;
  awards: ResumeAwardEntry[];
  hasAwards: boolean;
  /** True when every section is empty — templates can use this to render a placeholder instead of a blank page. */
  isEmpty: boolean;
};

const nonEmptyTrimmed = (items: string[]): string[] => items.map((s) => s.trim()).filter((s) => s.length > 0);

/**
 * Filters/trims raw `structured_content` down to exactly what each template
 * should render: blank scaffold entries (e.g. an "Add education" row the
 * user never filled in) are dropped, bullet/technology lists are trimmed of
 * blank strings, and each section gets a `has*` flag so a template can skip
 * the heading entirely rather than rendering an empty one.
 */
export function prepareResumeSections(content: ResumeStructuredContent): PreparedResumeSections {
  const contact = content.contact;
  const hasContact = Object.values(contact).some((v) => isFilled(v));

  const summary = (content.summary ?? "").trim();

  const education = content.education.filter(isEducationEntryFilled);

  const experience = content.experience.filter(isExperienceEntryFilled).map((entry) => ({
    ...entry,
    bullets: nonEmptyTrimmed(entry.bullets ?? []),
  }));

  const projects = content.projects.filter(isProjectEntryFilled).map((entry) => ({
    ...entry,
    bullets: nonEmptyTrimmed(entry.bullets ?? []),
    technologies: nonEmptyTrimmed(entry.technologies ?? []),
  }));

  const skills = nonEmptyTrimmed(content.skills ?? []);

  const certifications = content.certifications.filter(isNamedEntryFilled);
  const awards = content.awards.filter(isNamedEntryFilled);

  const hasEducation = education.length > 0;
  const hasExperience = experience.length > 0;
  const hasProjects = projects.length > 0;
  const hasSkills = skills.length > 0;
  const hasCertifications = certifications.length > 0;
  const hasAwards = awards.length > 0;
  const hasSummary = summary.length > 0;

  return {
    contact,
    hasContact,
    summary,
    hasSummary,
    education,
    hasEducation,
    experience,
    hasExperience,
    projects,
    hasProjects,
    skills,
    hasSkills,
    certifications,
    hasCertifications,
    awards,
    hasAwards,
    isEmpty:
      !hasContact && !hasSummary && !hasEducation && !hasExperience && !hasProjects && !hasSkills && !hasCertifications && !hasAwards,
  };
}

/** Joins the non-empty contact fields with a separator, for a single-line contact header. */
export function formatContactLine(contact: ResumeContact, separator = "  •  "): string {
  return [contact.location, contact.email, contact.phone, contact.linkedin, contact.portfolio]
    .filter((v) => isFilled(v))
    .join(separator);
}

/** Formats a start/end date pair as "Start – End", falling back gracefully when either side is blank. */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = (startDate ?? "").trim();
  const end = (endDate ?? "").trim();
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return end;
  return "";
}
