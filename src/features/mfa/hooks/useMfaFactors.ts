import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

/**
 * Thin wrapper around Supabase Auth's native TOTP MFA API
 * (supabase.auth.mfa.*) — verified against the installed
 * @supabase/supabase-js@2.112.4 (@supabase/auth-js@2.112.4) type defs
 * (node_modules/@supabase/auth-js/dist/main/GoTrueClient.d.ts /
 * lib/types.d.ts): `enroll`, `challenge`, `verify`, `challengeAndVerify`,
 * `unenroll`, `listFactors`, `getAuthenticatorAssuranceLevel` all exist on
 * `supabase.auth.mfa` in this version. No custom TOTP implementation exists
 * anywhere in this app — Supabase manages the actual secret/QR/verification
 * server-side on their end.
 *
 * This hook only tracks the caller's *verified* TOTP factor (Ascend only
 * ever enrolls one factor type, "totp") — used to render "2FA is
 * enabled/disabled" in the Profile settings panel.
 */
export function useMfaFactors() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      setVerifiedFactorId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      console.error("[useMfaFactors] listFactors failed:", error.message);
      setVerifiedFactorId(null);
      setLoading(false);
      return;
    }
    const verified = (data?.totp ?? []).find((f) => f.status === "verified");
    setVerifiedFactorId(verified?.id ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    // Deferred to a microtask, matching useGithubConnection.ts's convention
    // to avoid the set-state-in-effect cascading render warning.
    Promise.resolve().then(() => reload());
  }, [reload]);

  return {
    loading,
    mfaEnabled: Boolean(verifiedFactorId),
    verifiedFactorId,
    reload,
  };
}
