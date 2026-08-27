/** The owner's own preferences row (`public_profiles` table, RLS-scoped —
 * see supabase/migrations/017_public_profiles.sql). Read/written directly
 * from the client via usePublicProfile.ts, same pattern as useResumes.ts. */
export type PublicProfileSettings = {
  slug: string;
  isPublic: boolean;
  showSkills: boolean;
  showAlignmentHistory: boolean;
  showTargetRole: boolean;
};

/** The shape returned by the public, unauthenticated GET
 * /api/public-profile/:slug endpoint — only ever contains fields the owner
 * opted into (plus `resumeStrength`, which has no dedicated toggle and is
 * always shown on a public profile). Never contains the owner's id or email. */
export type PublicProfileData = {
  slug: string;
  resumeStrength: number | null;
  skills?: string[];
  alignmentHistory?: { alignment: number; createdAt: string }[];
  targetRole?: string;
};
