import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE } from "../../../config/api";
import { getApiErrorMessage } from "../../../lib/apiError";
import type { GithubConnection } from "../../../types/github";

/**
 * Reads the caller's own `github_connections` row (Phase 7 Task 9,
 * supabase/migrations/021_github_integration.sql). This table's RLS policy
 * technically allows the owning user to select every column on their own
 * row, INCLUDING `access_token_encrypted` — but that column must never
 * leave the server. This is the one and only frontend read of this table,
 * and it deliberately, explicitly selects only the three display-safe
 * columns below. Do not change this to `select("*")` — that would leak the
 * (encrypted, but still sensitive) token to the browser for no product
 * reason, defeating the point of encrypting it server-side in the first
 * place.
 */
const CONNECTION_SELECT_COLUMNS = "github_username, connected_at, scopes";

type ConnectionRow = { github_username: string; connected_at: string; scopes: string | null };

function rowToConnection(row: ConnectionRow): GithubConnection {
  return {
    githubUsername: row.github_username,
    connectedAt: row.connected_at,
    scopes: row.scopes ?? undefined,
  };
}

export type GithubConnectResult = { ok: true; authorizeUrl: string } | { ok: false; reason: "not_configured" | "error"; message?: string };

export function useGithubConnection() {
  const { user, session } = useAuth();
  const [connection, setConnection] = useState<GithubConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    if (!user) {
      setConnection(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("github_connections")
      .select(CONNECTION_SELECT_COLUMNS)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) {
          console.error("[useGithubConnection] load failed:", err);
          setError(err.message);
          setLoading(false);
          return;
        }
        setConnection(data ? rowToConnection(data as ConnectionRow) : null);
        setError(null);
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    // Deferred to a microtask to avoid the set-state-in-effect cascading
    // render warning, matching useSavedJobs.ts / useIsAdmin.ts elsewhere.
    Promise.resolve().then(() => reload());
  }, [reload]);

  /**
   * Starts the OAuth flow: asks the backend for a real authorize URL (or a
   * clear "not configured" answer). Never redirects the browser itself —
   * the caller decides what to do with the result (e.g. show a banner for
   * "not configured", or `window.location.href = authorizeUrl` once real).
   */
  const startConnect = useCallback(
    async (includePrivate: boolean): Promise<GithubConnectResult> => {
      if (!session?.access_token) {
        return { ok: false, reason: "error", message: "You must be logged in." };
      }
      try {
        const res = await fetch(
          `${API_BASE}/api/github/connect?includePrivate=${includePrivate ? "true" : "false"}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, reason: "error", message: getApiErrorMessage(data, "Failed to start GitHub connection") };
        }
        if (!data.configured) {
          return { ok: false, reason: "not_configured" };
        }
        return { ok: true, authorizeUrl: data.authorizeUrl };
      } catch (e) {
        return { ok: false, reason: "error", message: e instanceof Error ? e.message : "Failed to start GitHub connection" };
      }
    },
    [session?.access_token],
  );

  const disconnect = useCallback(async (): Promise<{ error: string | null }> => {
    if (!session?.access_token) return { error: "You must be logged in." };
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/github/disconnect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: getApiErrorMessage(data, "Failed to disconnect GitHub") };
      }
      setConnection(null);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed to disconnect GitHub" };
    } finally {
      setBusy(false);
    }
  }, [session?.access_token]);

  return { connection, loading, error, busy, reload, startConnect, disconnect };
}
