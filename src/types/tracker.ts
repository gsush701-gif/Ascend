export type TrackerStatus =
  | "Wishlist"
  | "Analyzed"
  | "Ready to Apply"
  | "Applied"
  | "Recruiter Contact"
  | "Interview"
  | "Technical Interview"
  | "Final Interview"
  | "Offer"
  | "Accepted"
  | "Rejected"
  | "Withdrawn";

/** Canonical pipeline order, earliest stage first. Shared by every place that
 * needs to render/iterate statuses in a sensible order (filters, funnel/status
 * bars, dropdowns). Existing statuses keep their original meaning — this is
 * purely the display/iteration order. */
export const TRACKER_STATUS_ORDER: TrackerStatus[] = [
  "Wishlist",
  "Analyzed",
  "Ready to Apply",
  "Applied",
  "Recruiter Contact",
  "Interview",
  "Technical Interview",
  "Final Interview",
  "Offer",
  "Accepted",
  "Rejected",
  "Withdrawn",
];

export type RolePriority = "high" | "medium" | "low";

/** Snapshot of report + alignment history saved when adding to tracker. */
export type SavedReportSnapshot = {
  alignment: number;
  coverage: number;
  skills: { name: string; status: "hit" | "miss" }[];
  missingSignals: string[];
  actions: string[];
  meta?: {
    pdfPages?: number;
    pdfTextLength?: number;
    resumeSkillsFound?: number;
  };
  alignmentHistory: { alignment: number; createdAt: string }[];
  resumeStrengthAtSave?: number;
  /** Regex-extracted salary range from this role's job description at analysis time. Absent when the JD didn't mention one. */
  salary?: {
    min: number;
    max: number;
    currency: string;
    period: "hourly" | "annual";
    estimatedAnnual?: { min: number; max: number; note: string };
  };
};

export type TrackerItem = {
  id: string;
  company: string;
  role: string;
  status: TrackerStatus;
  alignment: number;
  createdAt: string;
  /** Last modification time; equals createdAt on create. */
  updatedAt: string;
  nextStep: string;
  /** Full report + history at time of save; present when saved from Analyzer. */
  reportSnapshot?: SavedReportSnapshot;
  /** Free-form notes for this role. */
  notes?: string;
  /** Optional deadline (e.g. ISO date or "Feb 15"). */
  deadline?: string;
  /** Optional priority for follow-up. */
  priority?: RolePriority;
  /** Job description used for analysis; saved when adding from Analyzer, used for Re-analyze. */
  jobDescription?: string;
  /** AI-generated cover letter for this role; overwritten on regenerate. */
  coverLetter?: string;
  /** Last generated mock interview question set for this role; overwritten on regenerate. */
  interviewPrep?: {
    questions: { question: string; category: string }[];
    generatedAt: string;
  };

  // --- Phase 2b "application details" fields (all additive/optional) ---
  /** FK to the shared `jobs` table, when this role was created from a known posting. */
  jobId?: string;
  /** FK to the `resumes` table — which saved resume was used for this application. */
  resumeId?: string;
  /** Link to the original job posting (distinct from `applicationUrl`). */
  jobUrl?: string;
  /** Where this role was found, e.g. "LinkedIn", "referral". */
  source?: string;
  location?: string;
  remoteType?: string;
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  sponsorship?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  recruiterLinkedin?: string;
  /** Link to the actual application form/portal (distinct from `jobUrl`). */
  applicationUrl?: string;
  /** Whether this application came via a referral. Defaults to false. */
  referral?: boolean;
  /** Real typed deadline, distinct from the legacy free-text `deadline` field above. */
  deadlineAt?: string;
  appliedAt?: string;
  interviewAt?: string;
  offerAt?: string;
  rejectionAt?: string;
  followUpAt?: string;
};

export const LS_KEY = "internos_tracker_v1";
