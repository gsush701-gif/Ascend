/**
 * Public-safe view of a `github_connections` row (supabase/migrations/
 * 021_github_integration.sql). Deliberately excludes `access_token_encrypted`
 * — see src/features/integrations/hooks/useGithubConnection.ts for why that
 * field must never be requested from the client, even though RLS would
 * technically allow the owning user to read it.
 */
export type GithubConnection = {
  githubUsername: string;
  connectedAt: string;
  scopes?: string;
};

export type GithubRepo = {
  id: string;
  githubRepoId: number;
  name: string;
  fullName: string;
  description?: string;
  languages: Record<string, boolean> | null;
  topics: string[];
  isPrivate: boolean;
  isSelected: boolean;
  pushedAt?: string;
  importedAt: string;
};

export type ProjectMatchResult = {
  repoMatches: { repoId: string; repoName: string; matchedSkills: string[]; repoSkills: string[] }[];
  recommendedRepo: { repoId: string; repoName: string; matchedSkills: string[]; repoSkills: string[] } | null;
  uncoveredSkills: string[];
};
