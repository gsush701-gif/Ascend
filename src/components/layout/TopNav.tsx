import { Link, NavLink } from "react-router-dom";

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
          "rounded-xl px-4 py-2 text-sm transition",
          isActive
            ? "bg-white text-black"
            : "text-white/70 hover:bg-white/5 hover:text-white",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

export function TopNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <NavLink to="/dashboard" className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
                <span className="text-sm font-semibold">IO</span>
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">InternOS</div>
                <div className="text-xs text-white/60">Your internship platform</div>
              </div>
            </NavLink>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            <NavPill to="/dashboard" label="Dashboard" />
            <NavPill to="/roles" label="Roles" />
            <NavPill to="/resume-lab" label="Resume Lab" />
            <NavPill to="/insights" label="Insights" />
            <NavPill to="/profile" label="Profile" />
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Log out
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
