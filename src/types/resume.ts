export type SavedResume = {
  id: string;
  name: string;
  storagePath: string;
  extractedText: string | null;
  version: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

// --- Structured Resume Editor (Phase 7 Task 1) ---
// Mirrors supabase/migrations/015_resume_structured_content.sql's documented
// shape for `resumes.structured_content` exactly — keep the two in sync.

export type ResumeContact = {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
};

export type ResumeEducationEntry = {
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa: string;
};

export type ResumeExperienceEntry = {
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
};

export type ResumeProjectEntry = {
  name: string;
  description: string;
  technologies: string[];
  bullets: string[];
};

export type ResumeCertificationEntry = {
  name: string;
  issuer: string;
  date: string;
};

export type ResumeAwardEntry = {
  name: string;
  issuer: string;
  date: string;
};

export type ResumeStructuredContent = {
  contact: ResumeContact;
  summary: string;
  education: ResumeEducationEntry[];
  experience: ResumeExperienceEntry[];
  projects: ResumeProjectEntry[];
  skills: string[];
  certifications: ResumeCertificationEntry[];
  awards: ResumeAwardEntry[];
};

/** The exact top-level keys of `ResumeStructuredContent`, in display order —
 * shared by the section components, the suggestions panel, and the
 * backend's `/api/resume-suggestions` validation (server/lib/groq.js's
 * `RESUME_SECTIONS`). Keep the two lists in sync. */
export const RESUME_SECTIONS = [
  "contact",
  "summary",
  "education",
  "experience",
  "projects",
  "skills",
  "certifications",
  "awards",
] as const;

export type ResumeSectionKey = (typeof RESUME_SECTIONS)[number];

export const RESUME_SECTION_LABELS: Record<ResumeSectionKey, string> = {
  contact: "Contact",
  summary: "Summary",
  education: "Education",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  certifications: "Certifications",
  awards: "Awards",
};

export function emptyResumeStructuredContent(): ResumeStructuredContent {
  return {
    contact: { name: "", email: "", phone: "", location: "", linkedin: "", portfolio: "" },
    summary: "",
    education: [],
    experience: [],
    projects: [],
    skills: [],
    certifications: [],
    awards: [],
  };
}

export type ResumeSuggestionStatus = "pending" | "accepted" | "rejected";

export type ResumeSuggestion = {
  id: string;
  resumeId: string;
  section: ResumeSectionKey;
  originalText: string | null;
  proposedText: string;
  reason: string;
  status: ResumeSuggestionStatus;
  createdAt: string;
  updatedAt: string;
};

export type JobAnalysisRecord = {
  id: string;
  resumeId: string | null;
  roleId: string | null;
  jobDescription: string | null;
  // Loosely typed here (rather than importing Report) since older or
  // future-shaped results should still render without crashing.
  result: {
    alignment?: number;
    coverage?: number;
    roleTitle?: string;
    skills?: { name: string; status: "hit" | "miss"; importance?: string }[];
    missingSignals?: string[];
    actions?: string[];
    aiSummary?: string;
    breakdown?: {
      requiredSkills: number;
      technicalStack: number;
      resumeEvidence: number;
      ats: number;
    };
  };
  createdAt: string;
};
