-- In-app feedback from testers (signed in or not).
--
-- Written only by POST /api/feedback and read only by the admin backend route
-- GET /api/admin/feedback, both through the service-role client. Same shape as
-- error_logs: RLS enabled with zero policies, so the public anon key can
-- neither read nor write it through Supabase's auto-generated REST API.
--
-- `message` is free text the person chose to send. `email` is optional and only
-- present when they typed one to get a reply; it is never taken from an account.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  email text,
  page text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on feedback(created_at desc);

alter table feedback enable row level security;
-- Deliberately NO policies — see the header comment above.
