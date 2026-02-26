import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";
import { Button } from "../components/ui/Button";
import { card } from "../lib/ui";
import { cn } from "../lib/cn";

/**
 * Login page. For now (no auth): demo entry to app.
 * Later: show real login form; if logged in redirect to /dashboard.
 */
export function Login() {
  useEffect(() => {
    document.title = "Log in — Ascend";
    return () => { document.title = "Ascend"; };
  }, []);

  return (
    <PublicShell>
      <div className={cn("mx-auto max-w-sm space-y-6 p-8 text-center", card)}>
        <h1 className="text-xl font-semibold text-white">Log in</h1>
        <p className="text-sm text-white/50">
          Auth coming soon. Jump straight into the app.
        </p>
        <Link to="/dashboard" className="block">
          <Button variant="primary" className="w-full">
            Continue to Dashboard
          </Button>
        </Link>
        <p className="text-xs text-white/45">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="text-white/70 underline hover:text-white">
            Start free
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
