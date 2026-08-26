-- Persistent resume storage: a `resumes` table (metadata + extracted text)
-- plus a private Supabase Storage bucket for the actual PDF files.
-- Run in the Supabase SQL editor after supabase/migrations/004_interview_prep.sql.
--
-- This migration provisions the Storage bucket and its RLS policies via SQL
-- (matching how the rest of this project's schema is applied by hand in the
-- SQL editor, per README.md) rather than a one-off script — the Supabase SQL
-- editor runs with sufficient privilege to insert into `storage.buckets` and
-- create policies on `storage.objects` directly. No manual dashboard step is
-- required beyond running this file.

create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  storage_path text not null,
  extracted_text text,
  version int not null default 1,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table resumes enable row level security;

drop policy if exists "own resumes" on resumes;
create policy "own resumes" on resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists resumes_user_id_idx on resumes(user_id);

-- Private bucket for resume PDF files. `public = false` means files are
-- never served from a public URL — every read/write goes through the
-- authenticated Supabase client and is subject to the RLS policies below.
-- Objects must be stored under a `{user_id}/...` path (enforced by the app,
-- not the database) so `storage.foldername(name)`'s first segment can be
-- checked against `auth.uid()`.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "own resume objects read" on storage.objects;
create policy "own resume objects read" on storage.objects
  for select
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "own resume objects insert" on storage.objects;
create policy "own resume objects insert" on storage.objects
  for insert
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "own resume objects update" on storage.objects;
create policy "own resume objects update" on storage.objects
  for update
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "own resume objects delete" on storage.objects;
create policy "own resume objects delete" on storage.objects
  for delete
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
