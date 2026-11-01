import { Link } from "react-router-dom";
import { EXTENSION_STORE_URL } from "../../config/extension";
import { BackgroundFX } from "./BackgroundFX";
import { PublicNav } from "./PublicNav";
import { pageContainer } from "../../lib/ui";

type PublicShellProps = {
  children: React.ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-[#F4F5FA] text-slate-900">
      <BackgroundFX />
      <PublicNav />
      <main className={`relative pb-20 pt-16 ${pageContainer}`}>
        {children}
      </main>
      <footer className="relative flex items-center justify-center gap-4 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
        {/* Only advertised once it's in the Chrome Web Store (one-click install). */}
        {EXTENSION_STORE_URL && (
          <Link to="/extension" className="underline hover:text-slate-600">
            Chrome extension
          </Link>
        )}
        <Link to="/privacy" className="underline hover:text-slate-600">
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}
