import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, mfaGateOpen } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F5FA]">
        <span className="spinner inline-block h-6 w-6 rounded-full border-2 border-slate-300 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // A session that exists but hasn't cleared its MFA challenge (account has
  // a verified TOTP factor, current session is still only AAL1) is treated
  // the same as "not logged in" for route access — sent back to /login,
  // which renders the challenge screen (see Login.tsx) instead of the
  // password form since `user` is already set.
  if (!mfaGateOpen) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}
