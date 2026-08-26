-- Persists each /analyze result for logged-in users so past analyses can be
-- read back (mirrors the fix in 005_resumes.sql for the same class of bug
-- described for `resume_improvements` in docs/SAAS_AUDIT.md: written once,
-- never read back). Run in the Supabase SQL editor after
-- supabase/migrations/005_resumes.sql.
--
-- `result` stores the full analysis response shape (score, breakdown,
-- skills, missing signals, etc.) as-is, matching the JSON already returned
-- by POST /analyze — not normalized into separate columns in this pass.

create table if not exists job_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid references resumes(id) on delete set null,
  role_id uuid references roles(id) on delete set null,
  job_description text,
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table job_analyses enable row level security;

drop policy if exists "own job_analyses" on job_analyses;
create policy "own job_analyses" on job_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists job_analyses_user_id_idx on job_analyses(user_id);
