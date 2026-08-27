import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { fetchAdminWhoAmI } from "../api";

/**
 * UX-only admin check — decides whether to show the "Admin" nav link
 * (TopNav) without doing any real aggregation work server-side (GET
 * /api/admin/whoami does a plain email-allowlist check, nothing else). This
 * is NOT the security boundary: a non-admin who navigates to /admin directly
 * still gets a real 403 from every /api/admin/* route
 * (server/middleware/requireAdmin.js), independent of whatever this hook
 * decides to render.
 */
export function useIsAdmin() {
  const { session, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const token = session?.access_token;
    // Routed through a resolved-promise chain (rather than an early
    // synchronous setState for the "no token" case) purely so every state
    // update here happens from an async callback — avoids the
    // react-hooks/set-state-in-effect cascading-render warning.
    Promise.resolve()
      .then(() => (token ? fetchAdminWhoAmI(token) : null))
      .then((result) => {
        if (!cancelled) setIsAdmin(Boolean(result));
      })
      .catch(() => {
        // 401/403/network failure all mean "don't show admin UI to this
        // user" — never surfaced as an error, this is a silent UX check.
        if (!cancelled) setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, session?.access_token]);

  return { isAdmin, checked };
}
