import { useEffect } from "react";
import { Link } from "react-router-dom";
import { warmBackend } from "../../lib/warmBackend";
import { EXTENSION_STORE_URL } from "../../config/extension";
import { BackgroundFX } from "./BackgroundFX";
import { PublicNav } from "./PublicNav";
import { pageContainer } from "../../lib/ui";

type PublicShellProps = {
  children: React.ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  // Start waking the sleeping backend while the visitor is still reading.
  useEffect(() => {
    warmBackend();
  }, []);

  return (
    // overflow-x-clip: decorative glows must never widen the page on a phone.
    <div className="min-h-screen overflow-x-clip bg-[#F4F5FA] text-slate-900">
      <BackgroundFX />
      <PublicNav />
      <main className={`relative pb-20 pt-16 ${pageContainer}`}>
        {children}
      </main>
      <footer className="relative flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
        {/* Only advertised once it's in the Chrome Web Store (one-click install). */}
        {EXTENSION_STORE_URL && (
          <Link to="/extension" className="underline hover:text-slate-600">
            Chrome extension
          </Link>
        )}
        <Link to="/privacy" className="underline hover:text-slate-600">
          Privacy Policy
        </Link>
        <Link to="/terms" className="underline hover:text-slate-600">
          Terms
        </Link>
        <Link to="/refunds" className="underline hover:text-slate-600">
          Refunds
        </Link>
      </footer>
    </div>
  );
}
