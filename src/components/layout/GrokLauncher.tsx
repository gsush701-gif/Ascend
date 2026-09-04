import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

/**
 * Persistent bottom-right launcher for the Grok AI advisor — a discoverable,
 * chatbot-style entry point rendered once by AppShell so it's available on
 * every authenticated page. It only navigates to the existing /grok page;
 * no chat, session, or request logic lives here. Hidden on /grok itself
 * (the user is already there) and sits below every overlay (drawer z-40,
 * modal/nav higher) so it never covers focused content.
 */
export function GrokLauncher() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (pathname === "/grok") return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/grok")}
      aria-label="Ask Grok AI"
      title="Ask Grok AI"
      className="btn-press fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-cyan-500 p-3.5 text-sm font-semibold text-black shadow-lg ring-1 ring-black/5 transition hover:bg-cyan-400 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#F4F5FA] sm:bottom-6 sm:right-6 sm:px-4 sm:py-3"
    >
      <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
      <span className="hidden sm:inline">Grok AI</span>
    </button>
  );
}
