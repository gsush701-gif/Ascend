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
  /** Dynamic-conversation fields (supabase/migrations/024_voice_interview_conversation.sql).
   * Empty/null for legacy fixed-question sessions created before this — a
   * session is "conversation-shaped" if `transcript.length > 0`. */
  transcript: ConversationTurn[];
  conversationState: ConversationState | null;
  evaluation: InterviewEvaluation | null;
};

/**
 * One turn in the dynamic voice interview engine (Week 3) — replaces the
 * fixed question-list model for new sessions. See
 * src/features/voiceInterview/conversationLogic.ts and
 * src/routes/VoiceInterview.tsx.
 */
export type ConversationTurn = {
  speaker: "interviewer" | "candidate";
  text: string;
  at: string;
};

/** What the AI interviewer decided to do for its latest turn — drives pacing
 * (how long to stay on a topic) rather than exposing this to the candidate. */
export type InterviewTurnAction =
  | "FOLLOW_UP"
  | "CLARIFY"
  | "EXPLORE_DETAIL"
  | "TRANSITION_TOPIC"
  | "CLOSE_INTERVIEW";

/** Persisted alongside `transcript` — everything the turn-generation route
 * needs to keep pacing/topic-coverage consistent across requests, since the
 * server itself is stateless per request. */
export type ConversationState = {
  topicsCovered: string[];
  currentTopic: string | null;
  followUpCountForTopic: number;
  turnCount: number;
  stage: "active" | "closing";
};

/** Final interview evaluation (POST /api/interview-evaluation), generated
 * once when the conversation closes. All scores are 0-100. */
export type InterviewEvaluation = {
  overallScore: number;
  communication: number;
  relevance: number;
  technicalKnowledge: number;
  problemSolving: number;
  confidence: number;
  completeness: number;
  behavioralQuality: number;
  usedConcreteExamples: boolean;
  strongAnswers: string[];
  weakAnswers: string[];
  areasForImprovement: string[];
  suggestedBetterAnswers: string[];
  struggledFollowUps: string[];
};
