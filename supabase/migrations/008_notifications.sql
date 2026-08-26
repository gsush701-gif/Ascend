-- In-app notifications. Email/push delivery is out of scope for this pass
-- (would need a Resend integration + a real cron/scheduler, neither of which
-- exist yet). Deliberately no `related_role_id` column — the `roles` table
-- integration is reserved for a later phase.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  read boolean not null default false,
  related_contact_id uuid references contacts(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table notifications enable row level security;
create policy "own notifications" on notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index notifications_user_id_idx on notifications(user_id);
