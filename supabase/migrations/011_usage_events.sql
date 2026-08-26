-- Usage/analytics event tracking (Phase 3 — production infrastructure).
-- Populated by:
--   - server-side instrumentation of every Groq-calling route (fire-and-forget,
--     see server/lib/usageEvents.js), recording model/latency/request id
--     without ever storing resume/JD/answer content.
--   - POST /api/track, a minimal endpoint the frontend calls for a handful of
--     product events (signup, resume_uploaded, analysis_completed,
--     role_created, cover_letter_generated, interview_started).
--
-- user_id is nullable on purpose: anonymous/logged-out AI usage is still
-- tracked for cost visibility, just without a user association.
create table usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb,
  ai_model text,
  ai_latency_ms int,
  request_id text,
  created_at timestamptz not null default now()
);

alter table usage_events enable row level security;

-- All inserts happen server-side via the service-role client (which bypasses
-- RLS entirely), never from the browser — so only a select policy is needed,
-- letting a logged-in user see their own usage history if a UI for that is
-- ever built.
create policy "own usage_events" on usage_events for select using (auth.uid() = user_id);

create index usage_events_user_id_idx on usage_events(user_id);
create index usage_events_type_idx on usage_events(event_type);
