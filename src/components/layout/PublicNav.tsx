import { Link } from "react-router-dom";

export function PublicNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
              <span className="text-sm font-semibold">IO</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">InternOS</div>
              <div className="text-xs text-white/60">
                Internship Operating System
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <a className="transition hover:text-white" href="#how">
              How it works
            </a>
            <a className="transition hover:text-white" href="#preview">
              Preview
            </a>
            <Link to="/login" className="transition hover:text-white">
              Log in
            </Link>
            <Link
              to="/signup"
              className="transition hover:text-white"
            >
              Start free
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Start free
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
