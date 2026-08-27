-- Structured Resume Editor (Phase 7 Task 1): adds a structured, section-based
-- representation of a resume on top of the existing `resumes.extracted_text`
-- flat text (supabase/migrations/005_resumes.sql), plus a table for AI-drafted
-- edit suggestions the user reviews before accepting.
--
-- Additive only — `resumes`' existing RLS policy ("own resumes", scoped to
-- `auth.uid() = user_id`, set in migration 005) already covers the new
-- column with no changes needed here.
--
-- `resumes.structured_content` shape (nullable — null means "not parsed
-- yet", not "empty resume"):
-- {
--   "contact": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "portfolio": "" },
--   "summary": "",
--   "education": [{ "school": "", "degree": "", "field": "", "startDate": "", "endDate": "", "gpa": "" }],
--   "experience": [{ "company": "", "title": "", "location": "", "startDate": "", "endDate": "", "bullets": [""] }],
--   "projects": [{ "name": "", "description": "", "technologies": [""], "bullets": [""] }],
--   "skills": [""],
--   "certifications": [{ "name": "", "issuer": "", "date": "" }],
--   "awards": [{ "name": "", "issuer": "", "date": "" }]
-- }
-- Every field is a plain string/array — no nested "confidence" or metadata
-- fields. Missing/absent sections are empty ("" or []), never fabricated
-- (see server/lib/groq.js's parseResumeToStructured prompt).

alter table resumes
  add column if not exists structured_content jsonb;

-- AI-drafted suggestions for edits to one section of a resume's structured
-- content. Never applied automatically — the frontend shows each row for
-- the user to accept (optionally editing the proposed text first) or
-- reject; accepting updates `resumes.structured_content` client-side and
-- flips this row's status, rejecting just flips the status. `section` is one
-- of the top-level keys of `structured_content` above (contact, summary,
-- education, experience, projects, skills, certifications, awards).
create table if not exists resume_suggestions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references resumes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null,
  original_text text,
  proposed_text text not null,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table resume_suggestions enable row level security;

drop policy if exists "own resume_suggestions" on resume_suggestions;
create policy "own resume_suggestions" on resume_suggestions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists resume_suggestions_resume_id_idx on resume_suggestions(resume_id);
