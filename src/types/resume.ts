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
