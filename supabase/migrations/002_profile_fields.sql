-- Adds profile fields used by onboarding/Settings/Profile.
-- Run in the Supabase SQL editor after supabase/schema.sql.

alter table profiles
  add column if not exists full_name text,
  add column if not exists major text,
  add column if not exists target_role text,
  add column if not exists graduation_year text;
