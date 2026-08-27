import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { verifyRecoveryCode } from "../hooks/useRecoveryCodes";

/**
 * Shown after a successful supabase.auth.signInWithPassword() call whose
 * session still needs a second factor (Login.tsx checks
 * getAuthenticatorAssuranceLevel() — currentLevel 'aal1', nextLevel 'aal2').
 * Two paths, matching Login.tsx's existing form styling:
 *  - Enter a 6-digit TOTP code → supabase.auth.mfa.challengeAndVerify(),
 *    which elevates the session to a real aal2 JWT on success (this is
 *    Supabase's own native MFA verification, not app-level logic).
 *  - "Lost your device? Use a recovery code" → POST
 *    /api/mfa/verify-recovery-code (server/lib/recoveryCodes.js). This
 *    confirms possession of a valid, unused app-level recovery code and lets
 *    the user into Ascend, but — as documented on that route — does NOT
 *    elevate the Supabase session's real aal claim to aal2, since only
 *    Supabase's own TOTP verification can do that. No feature in this
 *    codebase currently gates anything on the JWT's aal claim via RLS, so in
 *    practice this distinction has no effect on what the user can do today;
 *    it's called out so a future aal-gated RLS policy doesn't get built
 *    without accounting for this recovery path.
 */
export function MfaChallengeForm({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [factorLoading, setFactorLoading] = useState(true);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data, error: err }) => {
      if (err) {
        console.error("[MfaChallengeForm] listFactors failed:", err.message);
      }
      const verified = data?.totp?.find((f) => f.status === "verified");
      setFactorId(verified?.id ?? null);
      setFactorLoading(false);
    });
  }, []);

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) {
      setError("No authenticator app is registered on this account.");
      return;
    }
    if (!code.trim()) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    onVerified();
  };

  const handleVerifyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setError("Enter a recovery code.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setSubmitting(false);
      setError("Your session expired — please log in again.");
      return;
    }
    const { ok, error: err } = await verifyRecoveryCode(token, recoveryCode.trim());
    setSubmitting(false);
    if (!ok) {
      setError(err);
      return;
    }
    onVerified();
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10">
          <KeyRound className="h-5 w-5 text-cyan-600" />
        </div>
        <h1 className="mt-3 font-display text-xl font-semibold tracking-tight text-slate-900">
          Two-factor verification
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {useRecovery
            ? "Enter one of your saved recovery codes."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
      </div>

      {error && (
        <div className="animate-fade-in rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {useRecovery ? (
        <form onSubmit={handleVerifyRecovery} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs text-slate-500" htmlFor="recovery-code">
              Recovery code
            </label>
            <Input
              id="recovery-code"
              type="text"
              autoComplete="one-time-code"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              placeholder="XXXXX-XXXXX"
              required
            />
          </div>
          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? "Verifying…" : "Verify recovery code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyTotp} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs text-slate-500" htmlFor="totp-code">
              Authentication code
            </label>
            <Input
              id="totp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              disabled={factorLoading}
              required
            />
          </div>
          <Button type="submit" variant="primary" className="w-full" disabled={submitting || factorLoading}>
            {submitting ? "Verifying…" : "Verify"}
          </Button>
        </form>
      )}

      <button
        type="button"
        onClick={() => {
          setUseRecovery((v) => !v);
          setError(null);
        }}
        className="mx-auto block text-xs font-medium text-slate-500 underline decoration-dotted hover:text-slate-800"
      >
        {useRecovery ? "Use your authenticator app instead" : "Lost your device? Use a recovery code"}
      </button>
    </div>
  );
}
