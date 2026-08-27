-- GitHub integration architecture (Phase 7 Task 9). No GitHub OAuth App is
-- registered for this project yet — there is no GITHUB_CLIENT_ID/
-- GITHUB_CLIENT_SECRET anywhere, and creating one requires the owner's own
-- GitHub account and dashboard action. This migration, server/lib/github.js,
-- server/lib/tokenCrypto.js, and the /api/github/* routes in server/index.js
-- build the complete, real, working architecture gated behind those env
-- vars being present — same "configured-or-honest-no-op" convention as
-- server/lib/stripe.js / server/lib/jobProviders/ elsewhere in this app.
-- Until the owner registers a real OAuth App, "Connect GitHub" on the
-- frontend renders a clear "not configured" state rather than attempting
-- (and failing) an OAuth redirect with no client id.
--
-- `github_connections` stores one row per user who has completed the OAuth
-- flow. Deliberately has ONLY a select policy for the client, never an
-- insert/update/delete policy — the real access token lives in
-- `access_token_encrypted` (AES-256-GCM, server/lib/tokenCrypto.js), and it
-- must only ever be written by server-side code using the service-role
-- client (the OAuth callback and the disconnect route are both backend
-- routes in server/index.js). Even though RLS technically allows the owning
-- user to `select *` on their own row including `access_token_encrypted`,
-- the frontend's own read of this table (src/features/integrations/) must
-- explicitly select only `github_username, connected_at, scopes` and never
-- `access_token_encrypted` — see that hook's own comment for why this is
-- checked deliberately rather than assumed.
create table if not exists github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  github_username text not null,
  github_user_id bigint not null,
  access_token_encrypted text not null,
  scopes text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table github_connections enable row level security;
drop policy if exists "own github_connection read" on github_connections;
create policy "own github_connection read" on github_connections for select using (auth.uid() = user_id);
-- No insert/update/delete policy for regular users: only the server-side
-- service-role client writes this table (the OAuth callback and disconnect
-- flow are both backend routes) — this is where the actual access token
-- lives, and it must never be client-writable even for the owning user.
create index if not exists github_connections_user_id_idx on github_connections(user_id);

-- `github_repositories` is a synced, per-user cache of the account's repos
-- (GET /api/github/repos), fully owned/writable by the user via normal RLS
-- (same "own_all" shape as saved_jobs/dismissed_jobs in
-- 020_job_discovery.sql) since it holds no secret — just repo metadata plus
-- the user's own `is_selected` toggle, which the frontend flips with a
-- direct Supabase update (src/features/integrations/hooks/useGithubRepos.ts),
-- matching this app's established pattern for simple owned-row writes
-- (useContacts.ts, useSavedJobs.ts) rather than a dedicated backend route.
create table if not exists github_repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  github_repo_id bigint not null,
  name text not null,
  full_name text not null,
  description text,
  languages jsonb,
  topics text[],
  is_private boolean not null default false,
  is_selected boolean not null default false,
  pushed_at timestamptz,
  imported_at timestamptz not null default now(),
  unique (user_id, github_repo_id)
);
alter table github_repositories enable row level security;
drop policy if exists "own github_repositories" on github_repositories;
create policy "own github_repositories" on github_repositories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists github_repositories_user_id_idx on github_repositories(user_id);
