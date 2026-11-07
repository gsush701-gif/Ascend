import { NavLink } from "react-router-dom";
import { AscendLogo } from "./AscendLogo";
import { PRIMARY_LINKS } from "./navLinks";

/**
 * The main navigation on large screens: a fixed column down the left with the
 * logo, the six destinations and a few small links at the bottom. Below the
 * `lg` breakpoint it is hidden and the top bar carries the navigation instead.
 */
export function Sidebar() {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-200/70 bg-white lg:flex"
      aria-label="Main"
    >
      <NavLink to="/dashboard" className="flex h-14 shrink-0 items-center gap-2.5 px-5">
        <AscendLogo className="h-7 w-auto" />
        <span className="font-display text-base font-semibold tracking-tight text-slate-900">Ascend</span>
      </NavLink>

      <nav className="mt-2 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3" aria-label="Primary navigation">
        {PRIMARY_LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition ${
                    isActive ? "text-cyan-600" : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 px-5 py-4 text-xs text-slate-400">
        <NavLink to="/contacts" className="transition hover:text-slate-600">
          Contact
        </NavLink>
        <NavLink to="/privacy" className="transition hover:text-slate-600">
          Privacy
        </NavLink>
        <NavLink to="/terms" className="transition hover:text-slate-600">
          Terms
        </NavLink>
      </div>
    </aside>
  );
}
