-- Adds an interview_prep field used by the Role Detail mock interview generator.
-- Run in the Supabase SQL editor after supabase/migrations/003_cover_letter.sql.

alter table roles
  add column if not exists interview_prep jsonb;
