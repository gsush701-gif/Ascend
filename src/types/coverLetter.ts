// Cover letter versioning (Phase 7 Task 4). Mirrors
// supabase/migrations/016_cover_letter_versions.sql's `cover_letter_versions`
// table — keep the two in sync.

export type CoverLetterSource = "generated" | "manual";

export type CoverLetterVersion = {
  id: string;
  roleId: string;
  versionNumber: number;
  name: string | null;
  content: string;
  source: CoverLetterSource;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
