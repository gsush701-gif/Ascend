-- Shared reference data about job postings. A `jobs` row is NOT user-owned —
-- it can be referenced by many different users' `roles` rows (e.g. two users
-- tracking the same posting). No `user_id` column and no RLS policy here on
-- purpose: RLS/ownership belongs on `roles` (which references this table),
-- not on this shared table. Run before 010_roles_expansion.sql, which adds
-- the `roles.job_id` FK pointing here.
--
-- Deliberately unused by the UI in this pass beyond the FK wiring in
-- 010_roles_expansion.sql — a browser-extension/job-discovery flow that
-- actually creates rows here is future work.

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  title text not null,
  description text,
  url text,
  source text,
  location text,
  remote_type text,
  employment_type text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  sponsorship text,
  experience_level text,
  posted_at timestamptz,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_company_idx on jobs(lower(company));
create index if not exists jobs_url_idx on jobs(url);

-- RLS is enabled with deliberately NO policies. This is not a "user-owned
-- table" (no user_id, no ownership concept), so there's no per-row auth.uid()
-- policy to write — but Supabase's standard project setup grants the anon
-- and authenticated Postgres roles table-level privileges by default, and
-- without RLS enabled here, that means anyone holding the public anon key
-- (bundled in every frontend build) could read/insert/update/delete arbitrary
-- rows in this table via the auto-generated REST API. Nothing in this
-- codebase queries `jobs` from the client today (confirmed: no
-- `.from("jobs")` call anywhere in src/), so enabling RLS with zero policies
-- (deny-all for anon/authenticated; the service-role client used server-side
-- always bypasses RLS) closes that exposure with no functional change. When
-- a future feature needs client access to this table, add a scoped policy
-- here rather than removing this line.
alter table jobs enable row level security;
