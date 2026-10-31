import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../config/api";

type FeatureAccess = { voiceInterview: boolean };

const LOCKED: FeatureAccess = { voiceInterview: false };

/**
 * UX-only check for features that are locked to an allowlist (currently the
 * voice interview — GET /api/feature-access, server/index.js). Defaults to
 * locked while loading and on any failure, so a locked feature is never shown
 * by accident. This is NOT the security boundary: the feature's server routes
 * independently 401/403 callers who aren't on the allowlist
 * (server/middleware/requireVoiceInterviewAccess.js).
 */
export function useFeatureAccess() {
  const { session, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<FeatureAccess>(LOCKED);
  const [checked, setChecked] = useState(false);
  const token = session?.access_token;

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    // Resolved-promise chain so every setState happens from an async
    // callback (same pattern as useIsAdmin, for the same lint rule).
    Promise.resolve()
      .then(async (): Promise<FeatureAccess> => {
        if (!token) return LOCKED;
        const res = await fetch(`${API_BASE}/api/feature-access`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return LOCKED;
        const data = (await res.json().catch(() => ({}))) as Partial<FeatureAccess>;
        return { voiceInterview: data.voiceInterview === true };
      })
      .catch(() => LOCKED)
      .then((result) => {
        if (cancelled) return;
        setAccess(result);
        setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, token]);

  return { ...access, checked };
}
