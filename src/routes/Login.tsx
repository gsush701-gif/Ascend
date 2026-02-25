import { Link } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";

/**
 * Login page. For now (no auth): demo entry to app.
 * Later: show real login form; if logged in redirect to /dashboard.
 */
export function Login() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-sm space-y-6 pt-10 text-center">
        <h1 className="text-2xl font-semibold text-white">Log in</h1>
        <p className="text-sm text-white/60">
          No auth yet. Use the app in demo mode.
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
