import { Link } from "react-router-dom";
import { AscendLogo } from "./AscendLogo";
import { pageContainer } from "../../lib/ui";

export function PublicNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-[#F4F5FA]/95 backdrop-blur-md">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-60"
        style={{ background: "linear-gradient(90deg, transparent, #22d3ee, #a78bfa, transparent)" }}
        aria-hidden
      />
      <div className={`mx-auto flex h-14 items-center justify-between ${pageContainer}`}>
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 shrink-0 items-center">
              <AscendLogo className="h-8 w-auto" />
            </div>
            <div className="hidden sm:block">
              <span className="font-display text-sm font-semibold tracking-tight text-slate-900">Ascend</span>
              <span className="ml-2 hidden text-xs text-slate-500 lg:inline">
                Your career, elevated
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <a
              href="#how"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-900/[0.04] hover:text-slate-900"
            >
              How it works
            </a>
            {/* Product preview section is temporarily disabled (see
                src/routes/Landing.tsx) — this link has no target while it's off.
            <a
              href="#preview"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-900/[0.04] hover:text-slate-900"
            >
              Preview
            </a>
            */}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-900/[0.04] hover:text-slate-900"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
            >
              Start free
            </Link>
          </div>
      </div>
    </header>
  );
}
