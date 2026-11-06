import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { card } from "../lib/ui";
import { cn } from "../lib/cn";
import { useAuth } from "../context/AuthContext";
import { OAuthButtons } from "../components/auth/OAuthButtons";

export function Signup() {
  const { user, loading: authLoading, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Where to go once signed up (e.g. the Analyze page with the example loaded).
  // Only a path on this site is accepted.
  const rawNext = searchParams.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const nextQuery = next === "/dashboard" ? "" : `?next=${encodeURIComponent(next)}`;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  useEffect(() => {
    document.title = "Start free — Ascend";
    return () => {
      document.title = "Ascend";
    };
  }, []);

  useEffect(() => {
    if (!authLoading && user) navigate(next, { replace: true });
  }, [authLoading, user, navigate, next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and a password.");
      return;
    }
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
    const { error: signUpError } = await signUp(email.trim(), password);
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    // If Supabase has email confirmation enabled, there's no session yet.
    setConfirmEmailSent(true);
  }

  if (confirmEmailSent) {
    return (
      <PublicShell>
        <div className={cn("animate-fade-in mx-auto max-w-sm space-y-4 p-8 text-center", card)}>
          <h1 className="text-xl font-semibold text-slate-900">Check your inbox</h1>
          <p className="text-sm text-slate-500">
            We sent a confirmation link to <span className="text-slate-800">{email}</span>.
            Confirm your email, then log in.
          </p>
          <Link to={`/login${nextQuery}`} className="block">
            <Button variant="primary" className="w-full">
              Go to login
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
        className={cn("mx-auto mt-4 max-w-sm space-y-5 p-6 sm:mt-8 sm:p-8", card)}
      >
        <div className="text-center">
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">Start free</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create an account to track roles and save your resume improvements.
          </p>
        </div>

        {error && (
          <div className="animate-fade-in rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <OAuthButtons next={next} position="above" />

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs text-slate-500" htmlFor="signup-email">
              Email
            </label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-500" htmlFor="signup-password">
              Password
            </label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-500" htmlFor="signup-confirm">
              Confirm password
            </label>
            <Input
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Get started"}
        </Button>

        <p className="text-center text-xs text-slate-400">
          By creating an account you agree to our{" "}
          <Link to="/terms" className="text-slate-600 underline hover:text-slate-900">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-slate-600 underline hover:text-slate-900">
            Privacy Policy
          </Link>
          . We store your resume and job data to run Ascend.
        </p>

        <p className="text-center text-xs text-slate-400">
          Already have an account?{" "}
          <Link to={`/login${nextQuery}`} className="text-slate-600 underline hover:text-slate-900">
            Log in
          </Link>
        </p>
      </form>
    </PublicShell>
  );
}
