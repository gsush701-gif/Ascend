import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";
import { Button } from "../components/ui/Button";
import { card } from "../lib/ui";
import { cn } from "../lib/cn";

/**
 * Signup page. For now (no auth): demo entry to app.
 * Later: show real signup form; after signup redirect to /dashboard.
 */
export function Signup() {
  useEffect(() => {
    document.title = "Start free — Ascend";
    return () => { document.title = "Ascend"; };
  }, []);

  return (
    <PublicShell>
      <div className={cn("mx-auto max-w-sm space-y-6 p-8 text-center", card)}>
        <h1 className="text-xl font-semibold text-white">Start free</h1>
        <p className="text-sm text-white/50">
          Auth coming soon. Try the full app experience now.
        </p>
        <Link to="/dashboard" className="block">
          <Button variant="primary" className="w-full">
            Get started
          </Button>
        </Link>
        <p className="text-xs text-white/45">
          Already have an account?{" "}
          <Link to="/login" className="text-white/70 underline hover:text-white">
            Log in
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
