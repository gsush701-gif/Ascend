import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { logEvent } from "../lib/analytics";

type AalState = { current: string | null; next: string | null } | null;

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /**
   * True once a session exists but Supabase reports it's only AAL1 while the
   * account has a verified TOTP factor requiring AAL2 — i.e. the user has
   * MFA enabled and hasn't completed the second factor for *this* session
   * yet. `ProtectedRoute` uses `mfaGateOpen` (below), not this flag directly,
   * so a session that later completes the recovery-code path (which cannot
   * change Supabase's real aal claim — see server/index.js's
   * /api/mfa/verify-recovery-code comment) is still let through.
   */
  needsMfaChallenge: boolean;
  /** True once it's safe to render protected content: either no MFA challenge is pending, or one was just completed (TOTP, which Supabase itself reports via a real aal2 session, or the app-level recovery-code path via `markMfaVerified`). */
  mfaGateOpen: boolean;
  /** Called by the recovery-code path (MfaChallengeForm) after the backend confirms a valid, unused code — see that component's comment on why this can't come from Supabase's own session state. */
  markMfaVerified: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  // null = "not yet checked for the CURRENT session" — deliberately distinct
  // from "checked, and no challenge needed" so a fresh sign-in can't
  // momentarily read as `mfaGateOpen: true` before the real AAL is known
  // (see the SIGNED_IN/INITIAL_SESSION handling below, which resets this to
  // null precisely to close that race). `loading` folds this in so neither
  // ProtectedRoute nor Login.tsx can act on a stale/default AAL value.
  const [aal, setAal] = useState<AalState>(null);
  const [mfaVerifiedThisSession, setMfaVerifiedThisSession] = useState(false);

  async function refreshMfaStatus() {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) {
      console.error("[auth] getAuthenticatorAssuranceLevel failed:", error.message);
      setAal({ current: null, next: null });
      return;
    }
    setAal({ current: data.currentLevel, next: data.nextLevel });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
      if (data.session) refreshMfaStatus();
      else setAal(null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setSessionLoading(false);

      if (event === "SIGNED_OUT" || !s) {
        setMfaVerifiedThisSession(false);
        setAal(null);
        return;
      }

      // Only reset to "pending" (null) on a genuinely new sign-in — a
      // routine TOKEN_REFRESHED/USER_UPDATED for an already-resolved session
      // must not blank `aal` and re-trigger the loading gate, or every
      // background token refresh would flash protected routes to a spinner.
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setAal(null);
      }
      refreshMfaStatus();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) setMfaVerifiedThisSession(false);
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) logEvent("signup");
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const mfaStatusPending = session !== null && aal === null;
  const needsMfaChallenge = aal !== null && aal.current === "aal1" && aal.next === "aal2";

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading: sessionLoading || mfaStatusPending,
        signIn,
        signUp,
        signOut,
        needsMfaChallenge,
        mfaGateOpen: !needsMfaChallenge || mfaVerifiedThisSession,
        markMfaVerified: () => setMfaVerifiedThisSession(true),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
