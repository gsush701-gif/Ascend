import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";

export function Navbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-900/60 bg-zinc-950/70 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl border border-zinc-800 bg-zinc-900 grid place-items-center shadow-sm">
            <span className="text-sm font-semibold">IO</span>
          </div>
          <div>
            <div className="text-lg font-semibold leading-5">InternOS</div>
            <div className="text-xs text-zinc-400">Job-Alignment Intelligence</div>
          </div>
        </NavLink>

        <nav className="flex items-center gap-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cn(
                "rounded-2xl px-3 py-2 text-sm border transition",
                isActive
                  ? "border-zinc-700 bg-zinc-900/70 text-zinc-100"
                  : "border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200"
              )
            }
          >
            Landing
          </NavLink>
          <NavLink
            to="/analyzer"
            className={({ isActive }) =>
              cn(
                "rounded-2xl px-3 py-2 text-sm border transition",
                isActive
                  ? "border-zinc-700 bg-zinc-900/70 text-zinc-100"
                  : "border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200"
              )
            }
          >
            Analyzer
          </NavLink>
          <NavLink
            to="/tracker"
            className={({ isActive }) =>
              cn(
                "rounded-2xl px-3 py-2 text-sm border transition",
                isActive
                  ? "border-zinc-700 bg-zinc-900/70 text-zinc-100"
                  : "border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200"
              )
            }
          >
            Tracker
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
