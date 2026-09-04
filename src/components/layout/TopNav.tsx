import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AscendLogo } from "./AscendLogo";
import { NotificationsBell } from "./NotificationsBell";
import { useAuth } from "../../context/AuthContext";
import { useIsAdmin } from "../../features/admin/hooks/useIsAdmin";

type NavItem = { to: string; label: string };

/**
 * Shown as pills in the bar on md+ screens. Also listed inside the menu on
 * smaller screens (where the pill row is hidden) so every destination stays
 * reachable. Routes are unchanged from the previous single NAV_LINKS list.
 */
const PRIMARY_LINKS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/roles", label: "Roles" },
  { to: "/analyzer", label: "Analyze" },
  { to: "/grok", label: "Grok AI" },
  { to: "/resumes", label: "Resumes" },
  { to: "/profile", label: "Profile" },
];

/** Overflow destinations — always live in the hamburger menu, never in the bar. */
const SECONDARY_LINKS: NavItem[] = [
  { to: "/companies", label: "Companies" },
  { to: "/jobs", label: "Jobs" },
  { to: "/goals", label: "Goals" },
  { to: "/analytics", label: "Analytics" },
  { to: "/report", label: "Report" },
  { to: "/contacts", label: "Contacts" },
  { to: "/resume-lab", label: "Resume Lab" },
];

function BarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          "rounded-lg px-3 py-1.5 text-sm font-medium transition",
          isActive
            ? "bg-slate-900 text-white"
            : "text-slate-500 hover:bg-slate-900/[0.04] hover:text-slate-900",
        ].join(" ")
      }
    >
      {item.label}
    </NavLink>
  );
}

function MenuLink({
  item,
  onSelect,
  className = "",
}: {
  item: NavItem;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <NavLink
      to={item.to}
      onClick={onSelect}
      className={({ isActive }) =>
        [
          "rounded-lg px-3 py-2 text-sm transition",
          isActive
            ? "bg-slate-900/[0.06] font-medium text-slate-900"
            : "text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900",
          className,
        ].join(" ")
      }
    >
      {item.label}
    </NavLink>
  );
}

export function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  // UX-only — see src/features/admin/hooks/useIsAdmin.ts. The real
  // enforcement is server-side on every /api/admin/* route regardless of
  // whether this link is shown.
  const { isAdmin } = useIsAdmin();
  const secondaryLinks = isAdmin
    ? [...SECONDARY_LINKS, { to: "/admin", label: "Admin" }]
    : SECONDARY_LINKS;

  const closeMenu = () => setMenuOpen(false);

  async function handleSignOut() {
    closeMenu();
    await signOut();
    navigate("/login");
  }

  // Dismiss the menu on outside-click or Escape — same interaction pattern as
  // NotificationsBell's dropdown in this folder.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-[#F4F5FA]/95 backdrop-blur-md">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-60"
        style={{ background: "linear-gradient(90deg, transparent, #22d3ee, #a78bfa, transparent)" }}
        aria-hidden
      />
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <NavLink
          to="/dashboard"
          className="flex shrink-0 items-center gap-2.5"
          onClick={closeMenu}
        >
          <AscendLogo className="h-7 w-auto" />
          <span className="font-display text-sm font-semibold tracking-tight text-slate-900">
            Ascend
          </span>
        </NavLink>

        <nav className="hidden items-center gap-1 md:flex">
          {PRIMARY_LINKS.map((item) => (
            <BarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          {user && <NotificationsBell />}

          <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden />

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center rounded-lg p-2 text-slate-600 transition hover:bg-slate-900/[0.04] hover:text-slate-900"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {menuOpen && (
              <div className="animate-fade-in absolute right-0 top-full z-[200] mt-2 flex max-h-[calc(100vh-5rem)] w-60 max-w-[85vw] flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                <nav aria-label="More navigation" className="flex flex-col">
                  {/* Primary destinations — only surfaced here on small screens;
                      on md+ they're pills in the bar. */}
                  {PRIMARY_LINKS.map((item) => (
                    <MenuLink
                      key={item.to}
                      item={item}
                      onSelect={closeMenu}
                      className="md:hidden"
                    />
                  ))}
                  <span className="my-1.5 h-px bg-slate-100 md:hidden" aria-hidden />

                  {secondaryLinks.map((item) => (
                    <MenuLink key={item.to} item={item} onSelect={closeMenu} />
                  ))}
                </nav>

                <span className="my-1.5 h-px bg-slate-100" aria-hidden />

                {user?.email && (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className="shrink-0 rounded-md border border-cyan-500/50 bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700">
                      Free
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-xs text-slate-500"
                      title={user.email}
                    >
                      {user.email}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-900/[0.04] hover:text-slate-900"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
