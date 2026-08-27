-- Voice interview sessions (Phase 7 Task 12 — Voice interview architecture).
--
-- Extends the existing text-based interview prep feature (roles.interview_prep,
-- supabase/migrations/004_interview_prep.sql; server/lib/groq.js's
-- generateInterviewQuestions/generateInterviewFeedback) with a spoken-answer
-- mode. Question generation and answer feedback are entirely reused from the
-- existing routes — this table only persists what's new: a session's
-- question set plus the transcribed spoken responses and their feedback as
-- the user progresses through it.
--
-- `questions` mirrors the shape already returned by
-- POST /api/generate-interview-questions: [{ question, category }].
-- `responses` is an array built up one entry at a time as the session
-- progresses: [{ questionIndex, transcript, feedback, strengths,
-- improvements, answeredAt }] — see src/features/voiceInterview/sessionLogic.ts
-- for the shape validated on the client before each write.
--
-- Written directly from the frontend under RLS (auth.uid() = user_id), same
-- pattern as contacts/resumes/cover_letter_versions — no backend route is
-- needed since nothing here requires a secret or server-side computation.

create table if not exists voice_interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid references roles(id) on delete set null,
  questions jsonb not null,
  responses jsonb not null default '[]'::jsonb,
  overall_notes text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table voice_interview_sessions enable row level security;

drop policy if exists "own voice_interview_sessions" on voice_interview_sessions;
create policy "own voice_interview_sessions" on voice_interview_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists voice_interview_sessions_user_id_idx on voice_interview_sessions(user_id);
create index if not exists voice_interview_sessions_role_id_idx on voice_interview_sessions(role_id);
