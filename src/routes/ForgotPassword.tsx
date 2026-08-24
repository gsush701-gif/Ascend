import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { card } from "../lib/ui";
import { cn } from "../lib/cn";
import { supabase } from "../lib/supabaseClient";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = "Reset password — Ascend";
    return () => {
      document.title = "Ascend";
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` },
    );
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <PublicShell>
        <div className={cn("mx-auto max-w-sm space-y-4 p-8 text-center", card)}>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">
            Check your inbox
          </h1>
          <p className="text-sm text-slate-600">
            If an account exists for <span className="text-slate-900">{email}</span>, we sent a
            password reset link. Follow it to choose a new password.
          </p>
          <Link to="/login" className="block">
            <Button variant="primary" className="w-full">
              Back to login
            </Button>
          </Link>
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
            Forgot password
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs text-slate-500" htmlFor="forgot-email">
            Email
          </label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </Button>

        <p className="text-center text-xs text-slate-400">
          <Link to="/login" className="text-slate-600 underline hover:text-slate-900">
            Back to login
          </Link>
        </p>
      </form>
    </PublicShell>
  );
}
