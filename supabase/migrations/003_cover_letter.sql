-- Adds a cover_letter field used by the Role Detail cover letter generator.
-- Run in the Supabase SQL editor after supabase/migrations/002_profile_fields.sql.

alter table roles
  add column if not exists cover_letter text;
