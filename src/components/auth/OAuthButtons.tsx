import { useState } from "react";
import { Github, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { buttonSecondary } from "../../lib/ui";
import { cn } from "../../lib/cn";

/**
 * "Continue with Google" / "Continue with GitHub" — Supabase Auth's native
 * OAuth login (supabase.auth.signInWithOAuth), NOT the custom GitHub OAuth
 * flow built for the separate "connect your GitHub account to import repos"
 * feature (src/features/integrations/, server/lib/github.js). Those two are
 * unrelated: this one signs a user IN to Ascend itself and is handled
 * entirely by Supabase's own auth server; the other lets an already-logged-in
 * user link their GitHub account for project-matching, via an OAuth App this
 * app itself registered. They will need separate GitHub OAuth App
 * registrations if both end up configured — signing in with GitHub here
 * does not connect the GitHub integration panel on the Profile page.
 *
 * signInWithOAuth (per the installed @supabase/auth-js@2.112.4 — see
 * node_modules/@supabase/auth-js/dist/main/GoTrueClient.d.ts) redirects the
 * whole page to the provider itself; there is nothing to await here besides
 * a same-tick `error` for a client-side failure (e.g. malformed config).
 * When the provider completes and redirects back to `redirectTo`, the
 * Supabase client's default `detectSessionInUrl` behavior parses the
 * resulting URL and establishes a session automatically — AuthContext's
 * existing `onAuthStateChange` listener picks that up with no extra code,
 * exactly like an email/password session, because Supabase issues the same
 * kind of session/JWT regardless of provider.
 *
 * Requires zero new app env vars. The owner must enable and configure each
 * provider in the Supabase Dashboard (Authentication → Providers) with their
 * own Google Cloud OAuth client / GitHub OAuth App credentials before these
 * buttons do anything. Verified live (GET request against this project's own
 * `/auth/v1/authorize?provider=...` endpoint — the same URL signInWithOAuth
 * navigates the browser to) rather than assumed: with a provider not yet
 * enabled, Supabase's Auth server responds directly with
 * `HTTP 400 {"code":400,"error_code":"validation_failed","msg":"Unsupported
 * provider: provider is not enabled"}` — it does NOT redirect back to
 * `redirectTo` first. Since signInWithOAuth does a full-page redirect to that
 * URL, clicking a button today lands the user on a blank page showing that
 * raw JSON instead of returning to Ascend — a clearly Supabase-side error
 * (the URL bar shows a supabase.co domain, not this app), not a silently
 * broken button, but jarring enough that the owner should configure both
 * providers (or hide these buttons) before announcing this feature.
 */
export function OAuthButtons({ next }: { next?: string }) {
  const [pending, setPending] = useState<"google" | "github" | null>(null);

  const handleOAuth = async (provider: "google" | "github") => {
    setPending(provider);
    const redirectTo = `${window.location.origin}${next || "/dashboard"}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    // On success the browser is already navigating away to the provider —
    // this only ever runs for a same-tick client-side failure.
    if (error) {
      setPending(null);
      console.error(`[oauth] signInWithOAuth(${provider}) failed:`, error.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">or continue with</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          disabled={pending !== null}
          className={cn(buttonSecondary, "w-full")}
        >
          {pending === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon className="h-4 w-4" />
          )}
          <span className="ml-1.5">Google</span>
        </button>
        <button
          type="button"
          onClick={() => handleOAuth("github")}
          disabled={pending !== null}
          className={cn(buttonSecondary, "w-full")}
        >
          {pending === "github" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
          <span className="ml-1.5">GitHub</span>
        </button>
      </div>
    </div>
  );
}

/** Lucide has no official Google "G" mark — this is the standard multi-color glyph, inline. */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.89c2.28-2.1 3.56-5.2 3.56-8.84z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.89-3.02c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.11C3.24 21.3 7.29 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.61H1.26A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l4.01-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.29 0 3.24 2.7 1.26 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}
