-- MFA recovery codes (Phase 7 Task 10 — Google/GitHub OAuth login + MFA).
-- Supabase Auth's native TOTP MFA (auth.mfa.enroll/challenge/verify/
-- unenroll) is used directly from the frontend for the actual second
-- factor — no custom TOTP logic exists in this app. What Supabase does NOT
-- provide is traditional single-use recovery codes for the "I lost my
-- authenticator device" case, so this table is a lightweight, purely
-- app-level complement, generated once when a user completes TOTP
-- enrollment (POST /api/mfa/recovery-codes/generate) and consulted only via
-- POST /api/mfa/verify-recovery-code on the login MFA-challenge screen.
--
-- Only ever stores a salted hash (server/lib/recoveryCodes.js, scrypt via
-- Node's built-in `crypto` — no new dependency), never the plaintext code,
-- which is shown to the user exactly once at generation time.
--
-- RLS is deliberately READ-ONLY for the owning user, same pattern as
-- `github_connections` (021_github_integration.sql): only server-side code
-- using the service-role client ever inserts, updates (marking a code
-- used), or deletes rows here. This is not just "defense in depth" — if an
-- authenticated client could `update` its own rows, a compromised session
-- (or a bug in client code) could clear `used_at` on an already-used
-- recovery code and resurrect it, defeating the single-use guarantee that
-- is the entire point of this table. The frontend's own read of this table
-- (recovery-code remaining-count display) must select only `id, used_at,
-- created_at` and never `code_hash` — mirroring github_connections' comment
-- about never selecting `access_token_encrypted` from the client.
create table if not exists mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table mfa_recovery_codes enable row level security;
drop policy if exists "own mfa_recovery_codes read" on mfa_recovery_codes;
create policy "own mfa_recovery_codes read" on mfa_recovery_codes for select using (auth.uid() = user_id);
-- No insert/update/delete policy for regular users — see comment above.
create index if not exists mfa_recovery_codes_user_id_idx on mfa_recovery_codes(user_id);
create index if not exists mfa_recovery_codes_user_id_unused_idx on mfa_recovery_codes(user_id) where used_at is null;
