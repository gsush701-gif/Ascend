-- Additive-only expansion of `roles` for Phase 2b: job posting details,
-- recruiter contact info, salary/sponsorship, referral flag, and real typed
-- timestamptz milestone dates (deadline/applied/interview/offer/rejection/
-- follow-up). Every column is nullable (or has a safe default) and additive.
--
-- IMPORTANT: `deadline` (the pre-existing free-text column) is intentionally
-- left completely untouched here — not renamed, not retyped, no data
-- migrated out of it. The new `deadline_at` (real timestamptz) is a
-- separate, parallel column; the two are meant to coexist. See
-- docs/SAAS_AUDIT.md and the Phase 2b plan for why.
--
-- Run this after 009_jobs.sql (for the roles.job_id FK). The FK additions to
-- `jobs` and `resumes` are guarded below so this migration degrades
-- gracefully (skips just that one column, doesn't fail outright) if either
-- referenced table isn't present yet in a given environment.

alter table roles
  add column if not exists job_url text,
  add column if not exists source text,
  add column if not exists location text,
  add column if not exists remote_type text,
  add column if not exists employment_type text,
  add column if not exists salary_min numeric,
  add column if not exists salary_max numeric,
  add column if not exists salary_currency text,
  add column if not exists sponsorship text,
  add column if not exists recruiter_name text,
  add column if not exists recruiter_email text,
  add column if not exists recruiter_linkedin text,
  add column if not exists application_url text,
  add column if not exists referral boolean not null default false,
  add column if not exists deadline_at timestamptz,
  add column if not exists applied_at timestamptz,
  add column if not exists interview_at timestamptz,
  add column if not exists offer_at timestamptz,
  add column if not exists rejection_at timestamptz,
  add column if not exists follow_up_at timestamptz;

-- roles.job_id -> jobs(id). Guarded: only add if the `jobs` table exists
-- (it's created by 009_jobs.sql, which should run first) and the column
-- isn't already there.
do $$
begin
  if to_regclass('public.jobs') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'roles' and column_name = 'job_id'
    ) then
      alter table roles add column job_id uuid references jobs(id) on delete set null;
    end if;
  else
    raise notice 'Skipping roles.job_id: "jobs" table not found. Run supabase/migrations/009_jobs.sql first, then re-run this migration to add job_id.';
  end if;
end $$;

-- roles.resume_id -> resumes(id). Guarded the same way in case the prior
-- 005_resumes.sql migration hasn't been applied in this environment.
do $$
begin
  if to_regclass('public.resumes') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'roles' and column_name = 'resume_id'
    ) then
      alter table roles add column resume_id uuid references resumes(id) on delete set null;
    end if;
  else
    raise notice 'Skipping roles.resume_id: "resumes" table not found. Run supabase/migrations/005_resumes.sql first, then re-run this migration to add resume_id.';
  end if;
end $$;

-- Index on job_id, only if the column actually made it in above.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'roles' and column_name = 'job_id'
  ) then
    execute 'create index if not exists roles_job_id_idx on roles(job_id)';
  end if;
end $$;
