-- Cover letter versioning (Phase 7 Task 4): multiple named versions per
-- role, generated-vs-manual indicator, one active version per role.
--
-- This is purely additive. The existing `roles.cover_letter` text column
-- (see supabase/migrations/003_cover_letter.sql) is NOT removed and is NOT
-- migrated/backfilled by this file — it stays exactly as-is and becomes a
-- denormalized mirror of whichever version is currently `is_active`, kept in
-- sync by the application (src/features/coverLetters/hooks/useCoverLetterVersions.ts)
-- through the existing updateCoverLetter/useTracker write path. Every bit of
-- UI that already reads `item.coverLetter` directly keeps working unchanged
-- with zero migration risk, including roles created before this feature
-- existed that have a legacy `cover_letter` value and zero rows here.
--
-- Run in the Supabase SQL editor after supabase/migrations/015_resume_structured_content.sql.

create table if not exists cover_letter_versions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references roles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number int not null,
  name text,
  content text not null,
  source text not null default 'generated',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table cover_letter_versions enable row level security;

drop policy if exists "own cover_letter_versions" on cover_letter_versions;
create policy "own cover_letter_versions" on cover_letter_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists cover_letter_versions_role_id_idx on cover_letter_versions(role_id);

-- Guards against the version-numbering race described in useCoverLetterVersions.ts:
-- a concurrent double-create for the same role fails one of the two inserts
-- instead of silently producing two rows claiming the same version number.
create unique index if not exists cover_letter_versions_role_version_idx on cover_letter_versions(role_id, version_number);

-- Note: "only one active version per role" is enforced at the application
-- layer (deactivate-then-activate, sequential updates scoped by RLS to the
-- caller's own rows — same pattern as useResumes.ts's setDefaultResume), not
-- by a database constraint. A partial unique index on (role_id) where
-- is_active would need a deferred/transactional flip to avoid transiently
-- violating itself during the deactivate-then-activate sequence, which isn't
-- worth the complexity for a single-user-scoped table already protected by
-- RLS.
