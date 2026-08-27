import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

/** Mirrors the `content` jsonb shape server/lib/weeklyReport.js's
 * computeWeeklyReportContent builds — kept in sync manually since one side
 * is CommonJS and the other TypeScript (there's no shared build step
 * between server/ and src/ in this repo). */
export type WeeklyReportContent = {
  generatedAt: string;
  stats: {
    applications: number;
    interviews: number;
    offers: number;
    responseRatePercent: number | null;
    sampleTooSmall: boolean;
  };
  recommendations: string[];
  topMissingSkill: { skill: string; count: number } | null;
};

export type WeeklyReport = {
  id: string;
  weekStart: string;
  weekEnd: string;
  content: WeeklyReportContent;
  emailSentAt: string | null;
  createdAt: string;
};

type WeeklyReportRow = {
  id: string;
  week_start: string;
  week_end: string;
  content: WeeklyReportContent;
  email_sent_at: string | null;
  created_at: string;
};

function rowToReport(row: WeeklyReportRow): WeeklyReport {
  return {
    id: row.id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    content: row.content,
    emailSentAt: row.email_sent_at,
    createdAt: row.created_at,
  };
}

/**
 * Read-only history of automated weekly reports (Phase 7 Task 7) — RLS-scoped
 * direct-Supabase read from `weekly_reports` (supabase/migrations/019_weekly_reports.sql),
 * the user's own rows only. This table has no insert/update/delete policy
 * for regular users (only the backend's service-role client writes to it),
 * so this hook is read-only by design — there's no "create"/"update" here.
 *
 * Deliberately never throws on a missing table: if migration 019 hasn't
 * been applied to this environment yet, this degrades to an empty history
 * rather than breaking the rest of the Report page.
 */
export function useWeeklyReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setReports([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("weekly_reports")
      .select("id, week_start, week_end, content, email_sent_at, created_at")
      .order("week_start", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[useWeeklyReports] load failed (table may not exist yet):", error.message);
          setReports([]);
          setLoading(false);
          return;
        }
        setReports(((data as WeeklyReportRow[] | null) ?? []).map(rowToReport));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { reports, loading };
}
