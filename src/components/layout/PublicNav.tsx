import { Link } from "react-router-dom";
import { AscendLogo } from "./AscendLogo";
import { pageContainer } from "../../lib/ui";

export function PublicNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#07090D]/95 backdrop-blur-md">
      <div className={`mx-auto flex h-14 items-center justify-between ${pageContainer}`}>
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 shrink-0 items-center">
              <AscendLogo className="h-8 w-auto" />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-semibold text-white">Ascend</span>
              <span className="ml-2 hidden text-xs text-white/50 lg:inline">
                Your career, elevated
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <a
              href="#how"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              How it works
            </a>
            <a
              href="#preview"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              Preview
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Start free
            </Link>
          </div>
      </div>
    </header>
  );
}
