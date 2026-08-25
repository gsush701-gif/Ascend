import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { card } from "../lib/ui";
import { cn } from "../lib/cn";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export function ResetPassword() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Set new password — Ascend";
    return () => {
      document.title = "Ascend";
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
  }

  if (done) {
    return (
      <PublicShell>
        <div className={cn("animate-fade-in mx-auto max-w-sm space-y-4 p-8 text-center", card)}>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">
            Password updated
          </h1>
          <p className="text-sm text-slate-600">Taking you to your dashboard…</p>
        </div>
      </PublicShell>
    );
  }

  if (!loading && !session) {
    return (
      <PublicShell>
        <div className={cn("animate-fade-in mx-auto max-w-sm space-y-4 p-8 text-center", card)}>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">
            Reset link expired
          </h1>
          <p className="text-sm text-slate-600">
            This password reset link is invalid or has expired. Request a new one from the
            login page.
          </p>
          <Button type="button" variant="primary" className="w-full" onClick={() => navigate("/forgot-password")}>
            Request new link
          </Button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <form
        onSubmit={handleSubmit}
        className={cn("mx-auto max-w-sm space-y-5 p-8", card)}
      >
        <div className="text-center">
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">
            Set a new password
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose a new password for your account.
          </p>
        </div>

        {error && (
          <div className="animate-fade-in rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs text-slate-500" htmlFor="reset-password">
              New password
            </label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-500" htmlFor="reset-confirm">
              Confirm password
            </label>
            <Input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Saving…" : "Update password"}
        </Button>
      </form>
    </PublicShell>
  );
}
