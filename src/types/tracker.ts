export type TrackerStatus =
  | "Wishlist"
  | "Applied"
  | "Interview"
  | "Offer"
  | "Rejected";

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
};

export type TrackerItem = {
  id: string;
  company: string;
  role: string;
  status: TrackerStatus;
  alignment: number;
  createdAt: string;
  nextStep: string;
  /** Full report + history at time of save; present when saved from Analyzer. */
  reportSnapshot?: SavedReportSnapshot;
};

export const LS_KEY = "internos_tracker_v1";
