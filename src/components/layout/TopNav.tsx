import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AscendLogo } from "./AscendLogo";

function NavPill({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "rounded-lg px-3 py-1.5 text-sm font-medium transition",
          isActive
            ? "bg-white text-black"
            : "text-white/60 hover:bg-white/5 hover:text-white",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/roles", label: "Roles" },
  { to: "/analyzer", label: "Analyze" },
  { to: "/resume-lab", label: "Resume Lab" },
  { to: "/profile", label: "Profile" },
  { to: "/settings", label: "Settings" },
];

export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#07090D]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <NavLink to="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <div className="flex h-9 shrink-0 items-center">
            <AscendLogo className="h-8 w-auto" />
          </div>
          <div className="hidden sm:block">
            <span className="text-sm font-semibold text-white">Ascend</span>
            <span className="ml-2 hidden text-xs text-white/50 lg:inline">
              Your career, elevated
            </span>
          </div>
        </NavLink>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ to, label }) => (
            <NavPill key={to} to={to} label={label} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/5 hover:text-white md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link
            to="/"
            className="hidden rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white md:block"
          >
            Log out
          </Link>
        </div>
      </div>

      {mobileOpen && (
        <div className="absolute inset-x-0 top-14 border-b border-white/10 bg-[#07090D] md:hidden">
          <nav className="flex flex-col gap-1 p-3">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-3 text-sm font-medium transition ${
                    isActive ? "bg-white text-black" : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-4 py-3 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              Log out
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
