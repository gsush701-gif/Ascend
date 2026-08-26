import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import type { JobAnalysisRecord } from "../../../types/resume";

type JobAnalysisRow = {
  id: string;
  resume_id: string | null;
  role_id: string | null;
  job_description: string | null;
  result: JobAnalysisRecord["result"];
  created_at: string;
};

function rowToRecord(row: JobAnalysisRow): JobAnalysisRecord {
  return {
    id: row.id,
    resumeId: row.resume_id,
    roleId: row.role_id,
    jobDescription: row.job_description,
    result: row.result ?? {},
    createdAt: row.created_at,
  };
}

const HISTORY_LIMIT = 25;

/**
 * Reads back the /analyze history the backend already persists to
 * `job_analyses` for logged-in users (server/index.js) — this is what
 * closes the "written but never read back" gap for that table (the same
 * class of bug the audit flagged for `resume_improvements`).
 */
export function useJobAnalyses() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<JobAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!user) {
      setAnalyses([]);
      return;
    }
    setLoading(true);
    supabase
      .from("job_analyses")
      .select("id, resume_id, role_id, job_description, result, created_at")
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(({ data, error: err }) => {
        if (err) {
          console.error("[useJobAnalyses] load failed:", err);
          setError(err.message);
        } else {
          setError(null);
          setAnalyses(((data as JobAnalysisRow[] | null) ?? []).map(rowToRecord));
        }
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { analyses, loading, error, refresh };
}
