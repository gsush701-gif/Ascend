import { useState } from "react";
import { ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { toast } from "../../../components/ui/toast";
import { useMfaFactors } from "../hooks/useMfaFactors";
import { useRecoveryCodesStatus } from "../hooks/useRecoveryCodes";

/**
 * The auth-js type declaration for `totp.qr_code` (@supabase/auth-js
 * 2.112.4's lib/types.d.ts) says it's raw SVG markup that "you can convert
 * to a URL by prepending `data:image/svg+xml;utf-8,`". Verified live against
 * this project's actual Supabase instance instead of trusting that comment:
 * the value returned by a real `auth.mfa.enroll({factorType:'totp'})` call is
 * already a complete `data:image/svg+xml;utf-8,<svg>...` URI — prepending
 * the prefix again produced a broken (double-encoded, zero natural-width)
 * image. This handles both shapes so it degrades gracefully if a future
 * Supabase version reverts to raw SVG.
 */
function toQrImageSrc(qrCode: string): string {
  if (qrCode.startsWith("data:")) return qrCode;
  return `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`;
}

type Mode = "idle" | "enrolling" | "showingCodes" | "disabling";

type PendingEnrollment = {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
};

/**
 * Two-factor authentication settings (Profile page — this app's existing
 * "account security" home, alongside Change password / Delete account).
 * Uses Supabase Auth's native TOTP MFA API directly
 * (supabase.auth.mfa.enroll/challengeAndVerify/unenroll) — no custom TOTP
 * implementation. Recovery codes are this app's own additive complement
 * (server/lib/recoveryCodes.js) since Supabase's MFA API has no equivalent —
 * see useRecoveryCodes.ts.
 */
export function MfaSettingsPanel() {
  const { user } = useAuth();
  const { loading: factorsLoading, mfaEnabled, verifiedFactorId, reload: reloadFactors } = useMfaFactors();
  const recoveryStatus = useRecoveryCodesStatus();
  const [mode, setMode] = useState<Mode>("idle");
  const [pending, setPending] = useState<PendingEnrollment | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [revealedCodes, setRevealedCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const startEnroll = async () => {
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (err) {
      toast.error({ title: "Couldn't start 2FA setup", description: err.message });
      return;
    }
    setPending({ factorId: data.id, qrCodeSvg: data.totp.qr_code, secret: data.totp.secret });
    setMode("enrolling");
  };

  const cancelEnroll = async () => {
    // Enrollment created an *unverified* factor server-side — clean it up so
    // it doesn't linger (Supabase caps factors per user) if the user backs out.
    if (pending) {
      await supabase.auth.mfa.unenroll({ factorId: pending.factorId }).catch(() => {});
    }
    setPending(null);
    setVerifyCode("");
    setError(null);
    setMode("idle");
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    if (!verifyCode.trim()) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({
      factorId: pending.factorId,
      code: verifyCode.trim(),
    });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    // Enrollment confirmed — generate this account's recovery-code batch now
    // (server/index.js's /api/mfa/recovery-codes/generate), shown exactly once.
    const { codes, error: genError } = await recoveryStatus.generate();
    setBusy(false);
    if (genError || !codes) {
      toast.error({
        title: "2FA is enabled, but recovery codes failed to generate",
        description: genError || "Try regenerating them below.",
      });
      setPending(null);
      setVerifyCode("");
      await reloadFactors();
      setMode("idle");
      return;
    }
    setRevealedCodes(codes);
    setPending(null);
    setVerifyCode("");
    await reloadFactors();
    setMode("showingCodes");
  };

  const regenerateCodes = async () => {
    setBusy(true);
    const { codes, error: err } = await recoveryStatus.generate();
    setBusy(false);
    if (err || !codes) {
      toast.error({ title: "Couldn't regenerate recovery codes", description: err || undefined });
      return;
    }
    setRevealedCodes(codes);
    setMode("showingCodes");
  };

  const startDisable = () => {
    setError(null);
    setDisablePassword("");
    setMode("disabling");
  };

  const confirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (!disablePassword) {
      setError("Enter your password to confirm.");
      return;
    }
    if (!verifiedFactorId) return;
    setError(null);
    setBusy(true);
    // Re-authentication step required before this irreversible-ish security
    // change (task spec): re-confirm the password via signInWithPassword
    // immediately before disabling, rather than trusting the existing
    // session alone. See Profile.tsx's account-deletion flow for the same
    // pattern applied to a fully irreversible action.
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: disablePassword,
    });
    if (authErr) {
      setBusy(false);
      setError("Incorrect password.");
      return;
    }
    const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId });
    if (unenrollErr) {
      setBusy(false);
      setError(unenrollErr.message);
      return;
    }
    await recoveryStatus.clear();
    setBusy(false);
    setDisablePassword("");
    await reloadFactors();
    setMode("idle");
    toast.success({ title: "Two-factor authentication disabled" });
  };

  const handleCopyAll = () => {
    if (!revealedCodes) return;
    navigator.clipboard.writeText(revealedCodes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const finishShowingCodes = () => {
    setRevealedCodes(null);
    setMode("idle");
  };

  if (factorsLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (mode === "showingCodes" && revealedCodes) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">Save these recovery codes now</p>
          <p className="mt-1 text-xs text-amber-800">
            Each code can be used once to sign in if you lose access to your authenticator app.
            They won&apos;t be shown again after you leave this page.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-dash-surface p-4 font-mono text-sm text-slate-800">
          {revealedCodes.map((code) => (
            <div key={code}>{code}</div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={handleCopyAll}>
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> <span className="ml-1.5">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> <span className="ml-1.5">Copy all</span>
              </>
            )}
          </Button>
          <Button type="button" variant="primary" onClick={finishShowingCodes}>
            I&apos;ve saved these codes
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "enrolling" && pending) {
    return (
      <form onSubmit={confirmEnroll} className="space-y-4">
        <p className="text-sm text-slate-600">
          Scan this QR code with an authenticator app (e.g. Google Authenticator, 1Password, Authy),
          then enter the 6-digit code it shows.
        </p>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <img
            src={toQrImageSrc(pending.qrCodeSvg)}
            alt="Scan with your authenticator app"
            className="h-40 w-40 shrink-0 rounded-lg border border-slate-200 bg-[#FFFFFF] p-2"
          />
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-slate-500">Can&apos;t scan? Enter this key manually:</p>
            <code className="block break-all rounded-lg border border-slate-200 bg-dash-surface px-3 py-2 text-xs text-slate-800">
              {pending.secret}
            </code>
          </div>
        </div>

        {error && (
          <div className="animate-fade-in rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs text-slate-500" htmlFor="mfa-verify-code">
            6-digit code
          </label>
          <Input
            id="mfa-verify-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            placeholder="123456"
            className="max-w-[160px]"
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Verifying…" : "Verify & enable"}
          </Button>
          <Button type="button" variant="secondary" onClick={cancelEnroll} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (mode === "disabling") {
    return (
      <form onSubmit={confirmDisable} className="space-y-3">
        <p className="text-sm text-slate-600">
          Enter your password to confirm disabling two-factor authentication.
        </p>
        {error && (
          <div className="animate-fade-in rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <Input
          type="password"
          autoComplete="current-password"
          value={disablePassword}
          onChange={(e) => setDisablePassword(e.target.value)}
          placeholder="Current password"
          className="max-w-xs"
        />
        <div className="flex gap-2">
          <Button type="submit" variant="dangerOutline" disabled={busy}>
            {busy ? "Disabling…" : "Confirm: disable 2FA"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setMode("idle")} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (mfaEnabled) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300/50 bg-emerald-50 px-4 py-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
          <div>
            <div className="text-sm font-medium text-emerald-900">Two-factor authentication is enabled</div>
            <div className="text-xs text-emerald-800">
              {recoveryStatus.loading
                ? "Loading recovery codes…"
                : `${recoveryStatus.remaining} of ${recoveryStatus.total} recovery codes remaining.`}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={regenerateCodes} disabled={busy}>
            Regenerate recovery codes
          </Button>
          <Button type="button" variant="dangerOutline" onClick={startDisable}>
            Disable two-factor authentication
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-dash-surface px-4 py-3">
        <ShieldOff className="h-4 w-4 shrink-0 text-slate-500" />
        <div className="text-sm text-slate-600">Two-factor authentication is not enabled on your account.</div>
      </div>
      <p className="text-sm text-slate-600">
        Add an authenticator app (TOTP) as a second sign-in step, using Supabase Auth&apos;s built-in MFA.
      </p>
      <Button type="button" onClick={startEnroll} variant="primary" disabled={busy}>
        {busy ? "Starting…" : "Enable two-factor authentication"}
      </Button>
    </div>
  );
}
