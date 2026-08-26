export type Contact = {
  id: string;
  name: string;
  company?: string;
  title?: string;
  email?: string;
  linkedinUrl?: string;
  relationship?: string;
  source?: string;
  notes?: string;
  /** ISO timestamp of the last time this person was contacted. */
  lastContactAt?: string;
  /** ISO timestamp for the next planned follow-up; drives due-notification generation. */
  nextFollowUpAt?: string;
  createdAt: string;
  updatedAt: string;
};

/** Suggestions only (schema column is plain `text`, not an enum). */
export const RELATIONSHIP_OPTIONS = [
  "Recruiter",
  "Hiring Manager",
  "Referral",
  "Alumni",
  "Peer / Networking",
  "Other",
];

/** Suggestions only (schema column is plain `text`, not an enum). */
export const SOURCE_OPTIONS = [
  "LinkedIn",
  "Referral",
  "Career Fair",
  "Cold Outreach",
  "Company Website",
  "Alumni Network",
  "Other",
];
