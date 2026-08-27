import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE } from "../../../config/api";
import { getApiErrorMessage } from "../../../lib/apiError";

/**
 * `mfa_recovery_codes` (supabase/migrations/022_mfa_recovery_codes.sql) has
 * a read-only RLS policy for the owning user — but this hook must select
 * only `id, used_at` and never `code_hash`, mirroring
 * useGithubConnection.ts's comment about never selecting
 * `access_token_encrypted`. Generating, clearing, and verifying a code all
 * go through backend routes instead, since those require the service-role
 * client (writes) or a server-side hash comparison the client must never do
 * itself.
 */
const REMAINING_SELECT_COLUMNS = "id, used_at";

export function useRecoveryCodesStatus() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [remaining, setRemaining] = useState(0);

  const reload = useCallback(async () => {
    if (!user) {
      setTotal(0);
      setRemaining(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("mfa_recovery_codes").select(REMAINING_SELECT_COLUMNS);
    if (error) {
      console.error("[useRecoveryCodesStatus] load failed:", error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as { id: string; used_at: string | null }[];
    setTotal(rows.length);
    setRemaining(rows.filter((r) => !r.used_at).length);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    Promise.resolve().then(() => reload());
  }, [reload]);

  /** Generates a fresh batch of 10 codes (replaces any existing set) — call right after successful TOTP enrollment. */
  const generate = useCallback(async (): Promise<{ codes: string[] | null; error: string | null }> => {
    if (!session?.access_token) return { codes: null, error: "You must be logged in." };
    try {
      const res = await fetch(`${API_BASE}/api/mfa/recovery-codes/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { codes: null, error: getApiErrorMessage(data, "Failed to generate recovery codes") };
      }
      await reload();
      return { codes: data.codes as string[], error: null };
    } catch (e) {
      return { codes: null, error: e instanceof Error ? e.message : "Failed to generate recovery codes" };
    }
  }, [session, reload]);

  /** Deletes all recovery codes for this user — call when 2FA is disabled. */
  const clear = useCallback(async (): Promise<{ error: string | null }> => {
    if (!session?.access_token) return { error: "You must be logged in." };
    try {
      const res = await fetch(`${API_BASE}/api/mfa/recovery-codes/clear`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: getApiErrorMessage(data, "Failed to clear recovery codes") };
      }
      await reload();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed to clear recovery codes" };
    }
  }, [session, reload]);

  return { loading, total, remaining, reload, generate, clear };
}

/**
 * Verifies a recovery code on the login MFA-challenge screen. Uses the
 * caller's own (AAL1) access token — this must be a backend call, not a
 * direct Supabase read, because it compares a submitted plaintext code
 * against a server-only hash column.
 */
export async function verifyRecoveryCode(
  accessToken: string,
  code: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/mfa/verify-recovery-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: getApiErrorMessage(data, "That recovery code is invalid or has already been used") };
    }
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to verify recovery code" };
  }
}
