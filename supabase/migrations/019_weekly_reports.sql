-- Automated weekly career reports (Phase 7 Task 7): converts the on-demand
-- report built in Phase 6a (src/features/report/stats.ts, src/routes/Report.tsx)
-- into something that can also run unattended on a schedule and persist a
-- history of past reports per user.
--
-- `profiles.weekly_reports_enabled` is the opt-in switch — off by default,
-- toggled from the Profile page via the existing direct-Supabase RLS-scoped
-- write pattern (src/lib/profile.ts), same as every other profile
-- preference field added in migrations 002/014.
--
-- `weekly_reports` stores one row per (user, week) the automated job
-- actually generated. `content` is a jsonb snapshot (stats + recommendations
-- computed at generation time, see server/lib/weeklyReport.js) rather than a
-- live-computed view, since a "what we sent you last week" history should
-- stay stable even as the user's tracked roles keep changing afterward.
-- `email_sent_at` is null until (and unless) an email was actually sent —
-- report generation/storage always happens even when RESEND_API_KEY isn't
-- configured; only the send step is skipped in that case.
--
-- The unique index on (user_id, week_start) is the duplicate-prevention
-- mechanism: the job upserts with "do nothing on conflict" (skip, not
-- error), so a re-run of the scheduled workflow for a week that's already
-- been generated for a given user is a safe no-op rather than a second row
-- or a failure that aborts the rest of the batch.
--
-- Run in the Supabase SQL editor after supabase/migrations/018_error_logs.sql.

alter table profiles
  add column if not exists weekly_reports_enabled boolean not null default false;

create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  content jsonb not null,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table weekly_reports enable row level security;

drop policy if exists "own weekly_reports select" on weekly_reports;
create policy "own weekly_reports select" on weekly_reports for select using (auth.uid() = user_id);

-- No insert/update/delete policy: this table is written only by the
-- backend's service-role client (server/lib/weeklyReport.js, called from
-- POST /api/cron/send-weekly-reports), never directly by an authenticated
-- user's browser session — RLS here exists purely to scope the frontend's
-- read-only "past reports" list (src/features/report) to the caller's own
-- rows.

create unique index if not exists weekly_reports_user_week_idx on weekly_reports(user_id, week_start);
create index if not exists weekly_reports_user_id_idx on weekly_reports(user_id);
