import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { getApiErrorMessage } from "../../lib/apiError";

/** A posting from the job feed, as the "new match" item carries it. */
export type AdvisorJob = {
  id: string;
  company: string;
  title: string;
  url: string | null;
  source: string | null;
  location: string | null;
  remoteType: string | null;
  employmentType: string | null;
  deadline: string | null;
  postedAt: string;
  description: string | null;
};

export type AdvisorItem = {
  id: string;
  signal: string;
  priority: number;
  roleId: string | null;
  title: string;
  why: string;
  action: { label: string; path: string };
  /** Present on a "new match" item: the posting, so it can be tracked in one click. */
  trackJob?: AdvisorJob;
};

export type AdvisorPlan = {
  items: AdvisorItem[];
  thin: boolean;
  roleCount: number;
  generatedAt: string;
};

const DISMISS_KEY = "ascend.advisor.dismissed";

/** Monday of the current week (UTC) as YYYY-MM-DD, so "not now" lasts the week. */
function weekKey(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

function readDismissed(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "null");
    return raw && raw.week === weekKey() && Array.isArray(raw.ids) ? raw.ids : [];
  } catch {
    return [];
  }
}

/**
 * The advisor's "This week" plan from GET /api/advisor/plan. A failure leaves
 * `plan` null and the card simply does not render; nothing else depends on it.
 * Dismissals ("not now") are remembered in this browser until next Monday.
 */
export function useAdvisorPlan() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [plan, setPlan] = useState<AdvisorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/advisor/plan`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(getApiErrorMessage(data, "Couldn't load your plan"));
        if (!cancelled) setPlan(data as AdvisorPlan);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load your plan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify({ week: weekKey(), ids: next }));
      } catch {
        // Private mode: it just comes back on the next visit.
      }
      return next;
    });
  }, []);

  const items = plan ? plan.items.filter((i) => !dismissed.includes(i.id)) : [];
  return { plan, items, loading, error, dismiss };
}
