-- Per-role resume PDF attached on the Role report page — replaces the
-- job-posting PDF viewer (025_role_job_posting_pdf.sql's `job-postings`
-- bucket/column are left in place, just unused by the UI now) with a
-- resume viewer instead. Deliberately separate from the account-wide
-- `resumes` table/bucket (005_resumes.sql) — this is a resume attached to
-- one specific tracked role, not a reusable saved resume, so it gets its
-- own bucket/column rather than reusing that table. Same pattern as both
-- of those otherwise.

alter table roles add column if not exists resume_storage_path text;

insert into storage.buckets (id, name, public)
values ('role-resumes', 'role-resumes', false)
on conflict (id) do nothing;

drop policy if exists "own role resume objects read" on storage.objects;
create policy "own role resume objects read" on storage.objects
  for select
  using (
    bucket_id = 'role-resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "own role resume objects insert" on storage.objects;
create policy "own role resume objects insert" on storage.objects
  for insert
  with check (
    bucket_id = 'role-resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "own role resume objects update" on storage.objects;
create policy "own role resume objects update" on storage.objects
  for update
  using (
    bucket_id = 'role-resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'role-resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "own role resume objects delete" on storage.objects;
create policy "own role resume objects delete" on storage.objects
  for delete
  using (
    bucket_id = 'role-resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
