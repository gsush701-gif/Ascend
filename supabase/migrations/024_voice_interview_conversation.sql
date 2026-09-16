-- Voice interview: dynamic conversation engine (replaces the fixed
-- question-list flow for NEW sessions only). Additive to
-- voice_interview_sessions (023_voice_interview_sessions.sql) — existing
-- rows keep their `questions`/`responses` shape and render via the existing
-- history UI path; new sessions use the columns added here instead and
-- render via a new conversation-transcript UI path. See
-- src/routes/VoiceInterview.tsx and src/features/voiceInterview/
-- conversationLogic.ts.
--
-- `questions` was NOT NULL because every session used to be created with a
-- pre-generated fixed list; a conversation session has no such list, so
-- that constraint is relaxed. `responses` already defaults to '[]'::jsonb
-- and stays NOT NULL — conversation sessions simply never populate it.

alter table voice_interview_sessions
  alter column questions drop not null;

alter table voice_interview_sessions
  add column if not exists transcript jsonb not null default '[]'::jsonb,
  add column if not exists conversation_state jsonb,
  add column if not exists evaluation jsonb;

comment on column voice_interview_sessions.transcript is
  'Turn-by-turn conversation for the dynamic interview engine: [{ speaker: "interviewer" | "candidate", text, at }]. Empty for legacy fixed-question sessions.';
comment on column voice_interview_sessions.conversation_state is
  '{ topicsCovered: string[], currentTopic: string | null, followUpCountForTopic: number, turnCount: number, stage: "active" | "closing" }. Null for legacy fixed-question sessions.';
comment on column voice_interview_sessions.evaluation is
  'Final interview evaluation (overallScore, sub-scores, strong/weak answers, areas for improvement, etc.), written once when the conversation closes. Null until then.';
