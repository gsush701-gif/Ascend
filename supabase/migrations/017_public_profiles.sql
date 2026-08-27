-- Database-backed shareable profiles (Phase 7 Task 5): replaces the entirely
-- client-side `src/lib/shareProfile.ts` mechanism (a base64-encoded
-- generate-time snapshot embedded in the URL's `?d=` query param, with no
-- real slug ownership/uniqueness and no way to toggle visibility).
--
-- This table stores only the owner's *preferences* — slug, public/private
-- toggle, and which fields to expose. It deliberately does NOT store a data
-- snapshot: the actual displayed values (skills, resume strength, alignment
-- history) are computed live from the user's current `roles` rows at view
-- time by GET /api/public-profile/:slug (server/index.js), so a public
-- profile always reflects current reality.
--
-- RLS here only allows the owning user to read/write their own row —
-- anonymous visitors never query this table directly. The public read path
-- is backend-mediated (using the service-role client) precisely because it
-- needs to look up a slug without knowing which user it belongs to ahead of
-- time, which RLS alone can't safely support for an anonymous caller.
--
-- Run in the Supabase SQL editor after supabase/migrations/016_cover_letter_versions.sql.

create table if not exists public_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique,
  is_public boolean not null default false,
  show_skills boolean not null default true,
  show_alignment_history boolean not null default true,
  show_target_role boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public_profiles enable row level security;

drop policy if exists "own public_profile read/write" on public_profiles;
create policy "own public_profile read/write" on public_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists public_profiles_slug_idx on public_profiles(slug);
