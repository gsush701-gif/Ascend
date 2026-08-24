export type SkillRow = { name: string; status: "hit" | "miss" };

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
