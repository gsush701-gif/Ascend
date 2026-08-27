import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import type {
  VoiceInterviewQuestion,
  VoiceInterviewResponse,
  VoiceInterviewSession,
} from "../../../types/voiceInterview";
import { sanitizeVoiceResponses } from "../sessionLogic";

type SessionRow = {
  id: string;
  role_id: string | null;
  questions: unknown;
  responses: unknown;
  overall_notes: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

const SELECT_COLUMNS =
  "id, role_id, questions, responses, overall_notes, started_at, completed_at, created_at";

function sanitizeQuestions(raw: unknown): VoiceInterviewQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (q): q is VoiceInterviewQuestion =>
      !!q &&
      typeof q === "object" &&
      typeof (q as Record<string, unknown>).question === "string" &&
      typeof (q as Record<string, unknown>).category === "string",
  );
}

function rowToSession(row: SessionRow): VoiceInterviewSession {
  return {
    id: row.id,
    roleId: row.role_id,
    questions: sanitizeQuestions(row.questions),
    responses: sanitizeVoiceResponses(row.responses),
    overallNotes: row.overall_notes,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

/**
 * CRUD for the `voice_interview_sessions` table (see
 * supabase/migrations/023_voice_interview_sessions.sql). Direct-to-Supabase,
 * RLS-protected — same pattern as useResumes.ts/useContacts.ts/
 * useCoverLetterVersions.ts for other per-user tables — no backend route
 * needed since nothing here requires a secret or server-side computation.
 * Question generation and answer feedback still go through the existing
 * POST /api/generate-interview-questions and POST /api/interview-feedback
 * routes; this hook only persists the resulting session/response data.
 */
export function useVoiceInterviewSessions(roleId: string | undefined) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<VoiceInterviewSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!user || !roleId) {
      setSessions([]);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("voice_interview_sessions")
      .select(SELECT_COLUMNS)
      .eq("role_id", roleId)
      .order("started_at", { ascending: false });
    if (err) {
      console.error("[useVoiceInterviewSessions] load failed:", err);
      setError(err.message);
    } else {
      setError(null);
      setSessions(((data as SessionRow[] | null) ?? []).map(rowToSession));
    }
    setLoading(false);
  }, [user, roleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startSession = useCallback(
    async (
      questions: VoiceInterviewQuestion[],
    ): Promise<{ session: VoiceInterviewSession | null; error: string | null }> => {
      if (!user) return { session: null, error: "You must be logged in." };
      const { data, error: insertError } = await supabase
        .from("voice_interview_sessions")
        .insert({
          user_id: user.id,
          role_id: roleId ?? null,
          questions,
          responses: [],
        })
        .select(SELECT_COLUMNS)
        .single();
      if (insertError || !data) {
        return { session: null, error: insertError?.message ?? "Failed to start session" };
      }
      const session = rowToSession(data as SessionRow);
      setSessions((prev) => [session, ...prev]);
      return { session, error: null };
    },
    [user, roleId],
  );

  /** Persists the full `responses` array for one session (the caller merges
   * with sessionLogic.ts's `upsertResponse` before calling this, matching
   * how useCoverLetterVersions.ts's callers compute the new value before
   * writing it). */
  const saveResponses = useCallback(
    async (
      sessionId: string,
      responses: VoiceInterviewResponse[],
    ): Promise<{ error: string | null }> => {
      const { error: updateError } = await supabase
        .from("voice_interview_sessions")
        .update({ responses })
        .eq("id", sessionId);
      if (updateError) return { error: updateError.message };

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, responses } : s)),
      );
      return { error: null };
    },
    [],
  );

  const completeSession = useCallback(
    async (sessionId: string, overallNotes?: string | null): Promise<{ error: string | null }> => {
      const completedAt = new Date().toISOString();
      const patch: Record<string, unknown> = { completed_at: completedAt };
      if (overallNotes !== undefined) patch.overall_notes = overallNotes;

      const { error: updateError } = await supabase
        .from("voice_interview_sessions")
        .update(patch)
        .eq("id", sessionId);
      if (updateError) return { error: updateError.message };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                completedAt,
                overallNotes: overallNotes !== undefined ? (overallNotes ?? null) : s.overallNotes,
              }
            : s,
        ),
      );
      return { error: null };
    },
    [],
  );

  return {
    sessions,
    loading,
    error,
    refresh,
    startSession,
    saveResponses,
    completeSession,
  };
}
