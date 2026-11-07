import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import type {
  ConversationState,
  ConversationTurn,
  InterviewEvaluation,
  VoiceInterviewQuestion,
  VoiceInterviewResponse,
  VoiceInterviewSession,
} from "../../../types/voiceInterview";
import { sanitizeVoiceResponses } from "../sessionLogic";
import { initialConversationState } from "../conversationLogic";

type SessionRow = {
  id: string;
  role_id: string | null;
  questions: unknown;
  responses: unknown;
  overall_notes: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  transcript: unknown;
  conversation_state: unknown;
  evaluation: unknown;
};

const SELECT_COLUMNS =
  "id, role_id, questions, responses, overall_notes, started_at, completed_at, created_at, transcript, conversation_state, evaluation";

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

/** Runtime shape check for one transcript turn — same defensive philosophy
 * as sessionLogic.ts's isValidVoiceResponse (guards against a malformed row
 * before it's rendered). */
function isValidTurn(value: unknown): value is ConversationTurn {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.speaker === "interviewer" || v.speaker === "candidate") &&
    typeof v.text === "string" &&
    typeof v.at === "string"
  );
}

function sanitizeTranscript(raw: unknown): ConversationTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidTurn);
}

function sanitizeConversationState(raw: unknown): ConversationState | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (
    !Array.isArray(v.topicsCovered) ||
    !v.topicsCovered.every((t) => typeof t === "string") ||
    (v.currentTopic !== null && typeof v.currentTopic !== "string") ||
    typeof v.followUpCountForTopic !== "number" ||
    typeof v.turnCount !== "number" ||
    (v.stage !== "active" && v.stage !== "closing")
  ) {
    return null;
  }
  return v as unknown as ConversationState;
}

function sanitizeEvaluation(raw: unknown): InterviewEvaluation | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.overallScore !== "number") return null;
  return v as unknown as InterviewEvaluation;
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
    transcript: sanitizeTranscript(row.transcript),
    conversationState: sanitizeConversationState(row.conversation_state),
    evaluation: sanitizeEvaluation(row.evaluation),
  };
}

/**
 * CRUD for the `voice_interview_sessions` table (see
 * supabase/migrations/023_voice_interview_sessions.sql and
 * 024_voice_interview_conversation.sql). Direct-to-Supabase, RLS-protected —
 * same pattern as useResumes.ts/useContacts.ts/useCoverLetterVersions.ts for
 * other per-user tables — no backend route needed since nothing here
 * requires a secret or server-side computation.
 *
 * Two session shapes coexist: legacy fixed-question sessions
 * (`questions`/`responses`, via startSession/saveResponses — question
 * generation and per-answer feedback go through the existing
 * POST /api/generate-interview-questions and POST /api/interview-feedback
 * routes) and the Week 3 dynamic-conversation sessions (`transcript`/
 * `conversationState`/`evaluation`, via startConversation/
 * appendTranscriptTurns/saveEvaluation — turn generation and final scoring
 * go through POST /api/interview-turn and POST /api/interview-evaluation).
 * completeSession is shared by both shapes.
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
    // Deferred to a microtask: avoids React's set-state-in-effect cascading-render warning.
    Promise.resolve().then(() => refresh());
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

  /** Starts a new dynamic-conversation session — empty transcript, seed
   * conversation state, `questions: null` (the column now allows null, see
   * 024_voice_interview_conversation.sql). */
  const startConversation = useCallback(async (): Promise<{
    session: VoiceInterviewSession | null;
    error: string | null;
  }> => {
    if (!user) return { session: null, error: "You must be logged in." };
    const { data, error: insertError } = await supabase
      .from("voice_interview_sessions")
      .insert({
        user_id: user.id,
        role_id: roleId ?? null,
        questions: null,
        responses: [],
        transcript: [],
        conversation_state: initialConversationState(),
      })
      .select(SELECT_COLUMNS)
      .single();
    if (insertError || !data) {
      return { session: null, error: insertError?.message ?? "Failed to start interview" };
    }
    const session = rowToSession(data as SessionRow);
    setSessions((prev) => [session, ...prev]);
    return { session, error: null };
  }, [user, roleId]);

  /** Persists the running transcript + conversation state for a dynamic
   * session — called after every turn (mirrors saveResponses's
   * update-then-local-merge pattern). */
  const appendTranscriptTurns = useCallback(
    async (
      sessionId: string,
      transcript: ConversationTurn[],
      conversationState: ConversationState,
    ): Promise<{ error: string | null }> => {
      const { error: updateError } = await supabase
        .from("voice_interview_sessions")
        .update({ transcript, conversation_state: conversationState })
        .eq("id", sessionId);
      if (updateError) return { error: updateError.message };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, transcript, conversationState } : s,
        ),
      );
      return { error: null };
    },
    [],
  );

  /** Persists the final evaluation once a dynamic conversation closes. */
  const saveEvaluation = useCallback(
    async (sessionId: string, evaluation: InterviewEvaluation): Promise<{ error: string | null }> => {
      const { error: updateError } = await supabase
        .from("voice_interview_sessions")
        .update({ evaluation })
        .eq("id", sessionId);
      if (updateError) return { error: updateError.message };

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, evaluation } : s)),
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
    startConversation,
    appendTranscriptTurns,
    saveEvaluation,
    completeSession,
  };
}
