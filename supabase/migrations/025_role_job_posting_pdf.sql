-- Job-posting PDF attached to a tracked role — Role report page's drag-and-
-- drop PDF viewer. Mirrors 005_resumes.sql's table-column + private-bucket
-- pattern exactly, just scoped to `roles` instead of a dedicated table
-- (one PDF per role, not a versioned list like resumes).

alter table roles add column if not exists job_posting_storage_path text;

-- Private bucket for job-posting PDF files. `public = false` — every read/
-- write goes through the authenticated Supabase client, subject to the RLS
-- policies below. Objects are stored under a `{user_id}/...` path (enforced
-- by the app, not the database) so `storage.foldername(name)`'s first
-- segment can be checked against `auth.uid()`.
insert into storage.buckets (id, name, public)
values ('job-postings', 'job-postings', false)
on conflict (id) do nothing;

drop policy if exists "own job posting objects read" on storage.objects;
create policy "own job posting objects read" on storage.objects
  for select
  using (
    bucket_id = 'job-postings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "own job posting objects insert" on storage.objects;
create policy "own job posting objects insert" on storage.objects
  for insert
  with check (
    bucket_id = 'job-postings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "own job posting objects update" on storage.objects;
create policy "own job posting objects update" on storage.objects
  for update
  using (
    bucket_id = 'job-postings'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'job-postings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "own job posting objects delete" on storage.objects;
create policy "own job posting objects delete" on storage.objects
  for delete
  using (
    bucket_id = 'job-postings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
