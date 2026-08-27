-- Job Discovery architecture (Phase 7 Task 8): per-user save/dismiss on top
-- of the existing shared `jobs` reference table (009_jobs.sql). No changes
-- to `jobs` itself — it already has every field a real job-listing provider
-- would populate (company/title/description/url/source/location/
-- remote_type/employment_type/salary_min/salary_max/salary_currency/
-- sponsorship/experience_level/posted_at/deadline). This migration only adds
-- the two small user-owned tables needed for "save this posting" and
-- "dismiss this posting", both scoped by RLS the same way every other
-- user-owned table in this app is (see e.g. 007_contacts.sql).
--
-- There is deliberately no `jobs` row seeding here and no fixture/sample
-- data of any kind — this app has no compliant job-listing data provider
-- configured yet (see server/lib/jobProviders/), and inserting fabricated
-- postings into `jobs`, even for "testing", would misrepresent real listings
-- to real users. `jobs` stays genuinely empty until a real provider is wired
-- in; these tables work correctly against zero rows in the meantime (an
-- honest empty state, not a broken one).

create table if not exists saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);
alter table saved_jobs enable row level security;
drop policy if exists "own saved_jobs" on saved_jobs;
create policy "own saved_jobs" on saved_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists saved_jobs_user_id_idx on saved_jobs(user_id);

create table if not exists dismissed_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);
alter table dismissed_jobs enable row level security;
drop policy if exists "own dismissed_jobs" on dismissed_jobs;
create policy "own dismissed_jobs" on dismissed_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists dismissed_jobs_user_id_idx on dismissed_jobs(user_id);
