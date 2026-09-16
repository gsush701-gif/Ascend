import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { API_BASE } from "../../../config/api";

type PlanConfig = {
  name: string;
  priceMonthly: number;
  limits: Record<string, number>;
};

type PlansResponse = {
  plans: Record<string, PlanConfig>;
  defaultPlan: string;
  usageLabels: Record<string, string>;
};

export type PlanInfo = {
  loading: boolean;
  plansData: PlansResponse | null;
  planKey: string;
  usageByType: Record<string, number>;
};

/**
 * Loads the central plan config (server/lib/plans.js, via GET /api/plans —
 * static, no auth required) plus this user's current plan and this month's
 * usage per AI operation, so the Plan panel can show real numbers instead of
 * hardcoded prose. Shared by the Profile page's Plan panel
 * (src/routes/Profile.tsx) and the account menu's Plan & billing modal
 * (src/components/layout/TopNav.tsx).
 *
 * Plan lookup mirrors server/lib/usage.js's getUserPlanKey(): no
 * `subscriptions` row, or a non-'active' status, both mean 'free' — there's
 * no billing yet, so in practice this is always 'free' today, but reading
 * the user's own row (RLS-scoped, same read-only pattern as the rest of
 * this app) keeps the display correct once a later task starts writing
 * real rows there.
 */
export function usePlanUsage(userId: string | undefined): PlanInfo {
  const [plansData, setPlansData] = useState<PlansResponse | null>(null);
  const [planKey, setPlanKey] = useState("free");
  const [usageByType, setUsageByType] = useState<Record<string, number>>({});
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [usageLoaded, setUsageLoaded] = useState(!userId);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/plans`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PlansResponse | null) => {
        if (cancelled || !data) return;
        setPlansData(data);
        setPlanKey((prev) => prev || data.defaultPlan);
      })
      .catch(() => { })
      .finally(() => {
        if (!cancelled) setPlansLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setUsageLoaded(false);

    supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        if (data.status === "active" && data.plan) setPlanKey(data.plan);
      });

    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    supabase
      .from("usage_events")
      .select("event_type")
      .eq("user_id", userId)
      .gte("created_at", startOfMonth.toISOString())
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          const counts: Record<string, number> = {};
          for (const row of data as { event_type: string }[]) {
            counts[row.event_type] = (counts[row.event_type] || 0) + 1;
          }
          setUsageByType(counts);
        }
        setUsageLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { loading: !plansLoaded || !usageLoaded, plansData, planKey, usageByType };
}
