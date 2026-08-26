-- Recruiter/networking CRM: standalone contacts table.
-- No FK to `roles` yet (deliberate — that integration is a later phase).
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  title text,
  email text,
  linkedin_url text,
  relationship text,
  source text,
  notes text,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table contacts enable row level security;
drop policy if exists "own contacts" on contacts;
create policy "own contacts" on contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists contacts_user_id_idx on contacts(user_id);
