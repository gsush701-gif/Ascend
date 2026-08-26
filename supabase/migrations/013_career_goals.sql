-- Career goals (Phase 5, Task 1) — a first-class, user-owned goal with
-- target counts (applications/interviews/offers) and an optional target
-- date. Progress against a goal is always computed client-side from the
-- user's real `roles` data (see src/features/goals) — nothing here stores
-- a derived/cached progress number, so it can never drift from reality.
create table career_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_date date,
  applications_target int,
  interviews_target int,
  offers_target int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table career_goals enable row level security;

create policy "own career_goals" on career_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index career_goals_user_id_idx on career_goals(user_id);
