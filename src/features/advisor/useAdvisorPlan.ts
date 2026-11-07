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

const PLAN_CACHE_KEY = "ascend.advisor.plan";

/** The last plan this browser fetched for this account, so the card can show at once. */
function readCachedPlan(userId: string | undefined): AdvisorPlan | null {
  if (!userId) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(PLAN_CACHE_KEY) ?? "null");
    return raw && raw.userId === userId && raw.plan && Array.isArray(raw.plan.items) ? (raw.plan as AdvisorPlan) : null;
  } catch {
    return null;
  }
}

function writeCachedPlan(userId: string | undefined, plan: AdvisorPlan): void {
  if (!userId) return;
  try {
    localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ userId, plan }));
  } catch {
    // Private mode or full storage: the card just waits for the network next time.
  }
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
 *
 * The last plan is kept in this browser, so the card shows straight away and is
 * refreshed in the background. That matters because the free server can take a
 * while to wake up, and the card should not hold a blank space while it does.
 */
export function useAdvisorPlan() {
  const { session } = useAuth();
  const token = session?.access_token;
  const userId = session?.user?.id;
  const [cached] = useState(() => readCachedPlan(userId));
  const [plan, setPlan] = useState<AdvisorPlan | null>(cached);
  const [loading, setLoading] = useState(cached === null);
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
        // A reply without a list of items is not a plan; treat it like a failed request.
        if (!Array.isArray((data as { items?: unknown }).items)) throw new Error("Couldn't load your plan");
        if (!cancelled) {
          setPlan(data as AdvisorPlan);
          writeCachedPlan(userId, data as AdvisorPlan);
        }
      } catch (e) {
        // Keep showing the saved plan if there is one; only a first load with nothing to show is an error.
        if (!cancelled && cached === null) setError(e instanceof Error ? e.message : "Couldn't load your plan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, userId, cached]);

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
