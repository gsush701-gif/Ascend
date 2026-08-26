export type SkillImportance = "required" | "preferred";

export type SkillRow = {
  name: string;
  status: "hit" | "miss";
  /** Classified from proximity to required/preferred language in the JD text. Optional for older cached reports saved before this field existed. */
  importance?: SkillImportance;
};

export type ScoreBreakdown = {
  requiredSkills: number;
  technicalStack: number;
  resumeEvidence: number;
  ats: number;
};

/** Regex-extracted salary range from a job description (server/lib/scoring.js's
 * extractSalary). Never fabricated — absent/null when the JD text doesn't
 * actually mention a salary. `estimatedAnnual` is only present for hourly
 * ranges and is explicitly labeled as an estimate (hourly * 2080 hours/year),
 * not a claim about the role's real annual pay. */
export type SalaryRange = {
  min: number;
  max: number;
  currency: string;
  period: "hourly" | "annual";
  estimatedAnnual?: {
    min: number;
    max: number;
    note: string;
  };
};

export type SignalState = "linked" | "mentioned_only" | "absent";

export type ResumeStrengthSignals = {
  quantifiedBullets: SignalState;
  github: SignalState;
  deployment: SignalState;
  projects: boolean;
  metrics: SignalState;
};

export type ResumeStrength = {
  score: number;
  signals: ResumeStrengthSignals;
};

export type Report = {
  alignment: number;
  coverage: number;
  roleTitle?: string;
  skills: SkillRow[];
  missingSignals: string[];
  actions: string[];
  /** AI-generated recruiter-style read on the resume/JD fit. Absent if the AI call wasn't configured or failed. */
  aiSummary?: string;
  /** Explainable components behind `alignment`. Absent for older cached/saved reports from before this field existed. */
  breakdown?: ScoreBreakdown;
  /** Regex-extracted salary range from the JD text, or null when none was mentioned. Absent for older cached/saved reports from before this field existed. */
  salary?: SalaryRange | null;
  meta?: {
    jdSkillsCount?: number;
    resumeSkillsFound?: number;
    pdfTextLength?: number;
    pdfPages?: number;
  };
};

export type AlignmentHistoryItem = {
  id: string;
  alignment: number;
  createdAt: string;
};

export type SharedProfileData = {
  skills: string[];
  strength: number;
  history: { alignment: number; createdAt: string }[];
};

export type ConfidenceLevel = "Low" | "Medium" | "High";

export type RoleDifficulty = "Entry-level" | "Competitive" | "Highly competitive";

export const HISTORY_KEY = "internos_alignment_history_v1";
export const SHARE_PAYLOAD_KEY = "internos_share_payload_v1";
export const LAST_RESUME_KEY = "internos_last_resume_v1";
