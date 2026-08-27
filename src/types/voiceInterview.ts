/** Same shape POST /api/generate-interview-questions returns and the
 * text-based interview prep already stores on roles.interview_prep — voice
 * mode reuses that route as-is (see server/lib/groq.js's
 * generateInterviewQuestions), not a parallel question format. */
export type VoiceInterviewQuestion = { question: string; category: string };

/** One answered question within a voice_interview_sessions row's `responses`
 * jsonb array. `feedback`/`strengths`/`improvements` come verbatim from
 * POST /api/interview-feedback (server/lib/groq.js's
 * generateInterviewFeedback) — the same feedback shape the text-based flow
 * already renders. */
export type VoiceInterviewResponse = {
  questionIndex: number;
  transcript: string;
  feedback: string;
  strengths: string[];
  improvements: string[];
  answeredAt: string;
};

/** Maps to the `voice_interview_sessions` table
 * (supabase/migrations/023_voice_interview_sessions.sql). */
export type VoiceInterviewSession = {
  id: string;
  roleId: string | null;
  questions: VoiceInterviewQuestion[];
  responses: VoiceInterviewResponse[];
  overallNotes: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
};
