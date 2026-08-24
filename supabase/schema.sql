-- Ascend database schema.
-- Run this once in your Supabase project's SQL editor (Dashboard → SQL Editor → New query).

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null,
  status text not null default 'Wishlist',
  alignment int not null default 0,
  next_step text,
  job_description text,
  notes text,
  deadline text,
  priority text,
  report_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resume_improvements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input text not null,
  improved text not null,
  why text,
  stack text,
  impact text,
  created_at timestamptz not null default now()
);

create index if not exists roles_user_id_idx on roles(user_id);
create index if not exists resume_improvements_user_id_idx on resume_improvements(user_id);

alter table profiles enable row level security;
alter table roles enable row level security;
alter table resume_improvements enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own roles" on roles;
create policy "own roles" on roles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own resume_improvements" on resume_improvements;
create policy "own resume_improvements" on resume_improvements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
