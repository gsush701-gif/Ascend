import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { card } from "../lib/ui";
import { cn } from "../lib/cn";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { user, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const next = searchParams.get("next") || "/dashboard";

  useEffect(() => {
    document.title = "Log in — Ascend";
    return () => {
      document.title = "Ascend";
    };
  }, []);

  useEffect(() => {
    if (!authLoading && user) navigate(next, { replace: true });
  }, [authLoading, user, next, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    navigate(next, { replace: true });
  }

  return (
    <PublicShell>
      <form
        onSubmit={handleSubmit}
        className={cn("mx-auto max-w-sm space-y-5 p-8", card)}
      >
        <div className="text-center">
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">Log in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back. Enter your details to continue.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs text-slate-500" htmlFor="login-email">
              Email
            </label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs text-slate-500" htmlFor="login-password">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-slate-500 underline hover:text-slate-900">
                Forgot password?
              </Link>
            </div>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>

        <p className="text-center text-xs text-slate-400">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="text-slate-600 underline hover:text-slate-900">
            Start free
          </Link>
        </p>
      </form>
    </PublicShell>
  );
}
