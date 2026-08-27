-- Persisted, queryable error log (Admin Dashboard, Phase 7 Task 6).
--
-- Before this migration, the only record of a server-side error was
-- console.error/stdout (Render captures it as logs, but that's not
-- queryable from inside the app) plus Sentry IF SENTRY_DSN happens to be
-- configured (server/lib/sentry.js — a genuine no-op otherwise, and no
-- Sentry API integration exists in this codebase). This table gives
-- GET /api/admin/system something real to read.
--
-- Populated exclusively server-side, fire-and-forget, from
-- server/lib/errors.js's sendError() helper whenever a response's status is
-- >= 500 (see that file's comment for why ordinary 4xx validation/auth
-- responses are NOT logged here — this table is for genuine server-side
-- failures worth an operator's attention, not routine bad user input).
--
-- Same "no client access at all" shape as supabase/migrations/009_jobs.sql's
-- `jobs` table: RLS enabled, zero policies. This is never queried by any
-- user's own session (not even the user named in `user_id`) — only the
-- admin backend routes (service-role client, which bypasses RLS entirely)
-- ever read from it, and nothing in this codebase ever inserts into it except
-- the server error handler itself.
create table if not exists error_logs (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  route text,
  status_code int not null,
  error_code text,
  message text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists error_logs_created_at_idx on error_logs(created_at desc);
create index if not exists error_logs_status_code_idx on error_logs(status_code);

alter table error_logs enable row level security;
-- Deliberately NO policies — see the header comment above. Without RLS
-- enabled here, Supabase's default anon/authenticated table-level grants
-- would let the public anon key read/write this table via the
-- auto-generated REST API; enabling RLS with zero policies denies both
-- roles entirely while the service-role client (used only in
-- server/index.js's admin routes and server/lib/errorLogs.js) still bypasses
-- RLS as usual.
