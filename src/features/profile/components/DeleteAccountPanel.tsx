import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../components/ui/toast";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabaseClient";
import { API_BASE } from "../../../config/api";
import { getApiErrorMessage } from "../../../lib/apiError";
import { useMfaFactors } from "../../mfa/hooks/useMfaFactors";

type Step = "confirm" | "password" | "typed" | "mfa";

const CONFIRM_WORD = "DELETE";

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="animate-fade-in rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

/**
 * Self-serve account deletion, shown in the account menu's modal. Irreversible,
 * so it takes several deliberate steps: a plain-language confirmation, then
 * proof it's really the account owner (the password, re-checked now; or typing
 * DELETE for people who signed in with Google/GitHub and have no password),
 * then a fresh authenticator code if two-factor is on. The server
 * (POST /api/account/delete) removes the account, its data and files, and
 * cancels any Stripe subscription first.
 */
export function DeleteAccountPanel({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const { user, session, signOut } = useAuth();
  const { mfaEnabled, verifiedFactorId } = useMfaFactors();

  // Google/GitHub-only accounts have no password to re-enter.
  const hasPassword = user?.identities ? user.identities.some((i) => i.provider === "email") : true;

  const [step, setStep] = useState<Step>("confirm");
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const performDeletion = async () => {
    if (!session?.access_token) {
      setError("Your session has expired. Sign in again to delete your account.");
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/account/delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(data, "Failed to delete account"));
      }
      await signOut();
      toast.success({ title: "Account deleted", description: "Your account and data have been removed." });
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete your account.");
      setBusy(false);
    }
  };

  const afterIdentityCheck = async () => {
    if (mfaEnabled) {
      setStep("mfa");
      setBusy(false);
      return;
    }
    await performDeletion();
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (authError) {
      setBusy(false);
      setError("Incorrect password.");
      return;
    }
    setPassword("");
    await afterIdentityCheck();
  };

  const handleTyped = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typed.trim() !== CONFIRM_WORD) {
      setError(`Type ${CONFIRM_WORD} in capitals to confirm.`);
      return;
    }
    setError(null);
    setBusy(true);
    await afterIdentityCheck();
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedFactorId) return;
    if (!code.trim()) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: verifiedFactorId,
      code: code.trim(),
    });
    if (mfaError) {
      setBusy(false);
      setError(mfaError.message);
      return;
    }
    setCode("");
    await performDeletion();
  };

  if (step === "confirm") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          This permanently deletes your Ascend account and everything in it: your resumes and uploaded PDFs, tracked
          roles and notes, cover letters, contacts, goals, and interview results.{" "}
          <strong className="text-slate-900">It cannot be undone.</strong>
        </p>
        <p className="text-sm text-slate-600">
          If you have a Pro subscription, it is cancelled as part of this. Download anything you want to keep first.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="danger" onClick={() => setStep(hasPassword ? "password" : "typed")}>
            Continue
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Keep my account
          </Button>
        </div>
      </div>
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={handlePassword} className="space-y-3">
        <p className="text-sm text-slate-600">For your security, confirm your password before we delete your account.</p>
        {error && <ErrorBox message={error} />}
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Current password"
          className="max-w-xs"
        />
        <div className="flex gap-2">
          <Button type="submit" variant="danger" disabled={busy}>
            {busy ? "Working…" : mfaEnabled ? "Confirm password" : "Delete my account"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (step === "typed") {
    return (
      <form onSubmit={handleTyped} className="space-y-3">
        <p className="text-sm text-slate-600">
          You signed in with Google or GitHub, so there's no password to confirm. Type{" "}
          <strong className="text-slate-900">{CONFIRM_WORD}</strong> to delete your account.
        </p>
        {error && <ErrorBox message={error} />}
        <Input
          type="text"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={CONFIRM_WORD}
          className="max-w-xs"
        />
        <div className="flex gap-2">
          <Button type="submit" variant="danger" disabled={busy}>
            {busy ? "Working…" : mfaEnabled ? "Continue" : "Delete my account"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleMfa} className="space-y-3">
      <p className="text-sm text-slate-600">
        Your account has two-factor authentication on. Enter a code from your authenticator app to finish deleting it.
      </p>
      {error && <ErrorBox message={error} />}
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="123456"
        className="max-w-[160px]"
      />
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={busy}>
          {busy ? "Deleting…" : "Verify and delete my account"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
