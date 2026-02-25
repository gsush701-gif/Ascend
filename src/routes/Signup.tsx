import { Link } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";

/**
 * Signup page. For now (no auth): demo entry to app.
 * Later: show real signup form; after signup redirect to /dashboard.
 */
export function Signup() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-sm space-y-6 pt-10 text-center">
        <h1 className="text-2xl font-semibold text-white">Start free</h1>
        <p className="text-sm text-white/60">
          No auth yet. Try the app in demo mode.
        </p>
        <Link
          to="/dashboard"
          className="btn-press inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          Continue to Dashboard
        </Link>
      </div>
    </PublicShell>
  );
}
