import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE } from "../../../config/api";
import { getApiErrorMessage } from "../../../lib/apiError";
import type { GithubRepo } from "../../../types/github";

type RepoRow = {
  id: string;
  github_repo_id: number;
  name: string;
  full_name: string;
  description: string | null;
  languages: Record<string, boolean> | null;
  topics: string[] | null;
  is_private: boolean;
  is_selected: boolean;
  pushed_at: string | null;
  imported_at: string;
};

function rowToRepo(row: RepoRow): GithubRepo {
  return {
    id: row.id,
    githubRepoId: row.github_repo_id,
    name: row.name,
    fullName: row.full_name,
    description: row.description ?? undefined,
    languages: row.languages,
    topics: row.topics ?? [],
    isPrivate: row.is_private,
    isSelected: row.is_selected,
    pushedAt: row.pushed_at ?? undefined,
    importedAt: row.imported_at,
  };
}

/**
 * `github_repositories` has a full owner RLS policy (021_github_integration.sql
 * — unlike `github_connections`, this table holds no secret), so the READ
 * here is a plain direct Supabase select, and toggling `is_selected` is a
 * plain direct Supabase update — same established pattern as
 * useContacts.ts/useSavedJobs.ts, no dedicated backend route needed for
 * either. The one thing that genuinely needs the backend is the initial
 * *sync* from the real GitHub API (GET /api/github/repos — it needs the
 * decrypted access token, which never reaches the client), so `sync()`
 * calls that route and then reloads from Supabase.
 */
export function useGithubRepos(connected: boolean) {
  const { user, session } = useAuth();
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!user || !connected) {
      setRepos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("github_repositories")
      .select("id, github_repo_id, name, full_name, description, languages, topics, is_private, is_selected, pushed_at, imported_at")
      .order("pushed_at", { ascending: false, nullsFirst: false })
      .then(({ data, error: err }) => {
        if (err) {
          console.error("[useGithubRepos] load failed:", err);
          setError(err.message);
          setLoading(false);
          return;
        }
        setRepos(((data as RepoRow[] | null) ?? []).map(rowToRepo));
        setError(null);
        setLoading(false);
      });
  }, [user, connected]);

  useEffect(() => {
    Promise.resolve().then(() => reload());
  }, [reload]);

  const sync = useCallback(async (): Promise<{ error: string | null }> => {
    if (!session?.access_token) return { error: "You must be logged in." };
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/github/repos`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = getApiErrorMessage(data, "Failed to sync GitHub repositories");
        setError(message);
        return { error: message };
      }
      reload();
      return { error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to sync GitHub repositories";
      setError(message);
      return { error: message };
    } finally {
      setSyncing(false);
    }
  }, [session?.access_token, reload]);

  const setSelected = useCallback(
    async (repoId: string, isSelected: boolean) => {
      setRepos((prev) => prev.map((r) => (r.id === repoId ? { ...r, isSelected } : r)));
      const { error: err } = await supabase
        .from("github_repositories")
        .update({ is_selected: isSelected })
        .eq("id", repoId);
      if (err) {
        console.error("[useGithubRepos] setSelected failed:", err);
        setError(err.message);
        // Revert the optimistic flip.
        setRepos((prev) => prev.map((r) => (r.id === repoId ? { ...r, isSelected: !isSelected } : r)));
      }
    },
    [],
  );

  return { repos, loading, syncing, error, reload, sync, setSelected };
}
