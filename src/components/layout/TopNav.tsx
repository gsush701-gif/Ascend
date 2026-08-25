import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AscendLogo } from "./AscendLogo";
import { useAuth } from "../../context/AuthContext";

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
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-500 hover:bg-slate-900/[0.04] hover:text-slate-900",
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
];

export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    setMobileOpen(false);
    await signOut();
    navigate("/login");
  }

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-[#F4F5FA]/95 backdrop-blur-md">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-60"
        style={{ background: "linear-gradient(90deg, transparent, #22d3ee, #a78bfa, transparent)" }}
        aria-hidden
      />
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <NavLink to="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <div className="flex h-9 shrink-0 items-center">
            <AscendLogo className="h-8 w-auto" />
          </div>
          <div className="hidden sm:block">
            <span className="font-display text-sm font-semibold tracking-tight text-slate-900">Ascend</span>
            <span className="ml-2 hidden text-xs text-slate-500 lg:inline">
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
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-900/[0.04] hover:text-slate-900 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {user?.email && (
            <span className="hidden items-center gap-2 lg:flex">
              <span className="rounded-md border border-cyan-500/50 bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700">
                Free
              </span>
              <span className="max-w-[160px] truncate text-xs text-slate-500" title={user.email}>
                {user.email}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="hidden rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-900/[0.04] hover:text-slate-900 md:block"
          >
            Log out
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="absolute inset-x-0 top-14 border-b border-slate-200 bg-[#F4F5FA] md:hidden animate-fade-in">
          <nav className="flex flex-col gap-1 p-3">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-3 text-sm font-medium transition ${
                    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg px-4 py-3 text-left text-sm text-slate-600 transition hover:bg-slate-900/[0.04] hover:text-slate-900"
            >
              Log out
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
