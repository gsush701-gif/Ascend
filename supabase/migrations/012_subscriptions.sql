-- Subscriptions (Phase 4a — schema only, no Stripe integration yet).
--
-- Every user is implicitly on the `free` plan (server/lib/plans.js) until a
-- row exists here for them with status = 'active' — see
-- server/lib/usage.js's getUserPlanKey(). No row is backfilled for existing
-- users; "no row" and "free" are treated as equivalent everywhere this table
-- is read. A later task wires up real Stripe checkout + webhooks, which will
-- be the only thing that ever inserts/updates rows here.
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan text not null default 'free',
  status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- Read-only for users on purpose: a user must never be able to grant
-- themselves a paid plan by writing their own row. Only a select policy
-- exists here — with RLS enabled and no insert/update/delete policy, both
-- are denied by default for the `anon`/`authenticated` roles. Inserts and
-- updates must only ever happen server-side via the service-role client
-- (which bypasses RLS entirely), once the Stripe webhook handler that owns
-- this table's writes exists.
drop policy if exists "own subscription read" on subscriptions;
create policy "own subscription read" on subscriptions for select using (auth.uid() = user_id);

create index if not exists subscriptions_user_id_idx on subscriptions(user_id);
