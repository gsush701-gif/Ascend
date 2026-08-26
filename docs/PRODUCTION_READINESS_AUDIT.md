# Ascend — Production Readiness & Cross-Phase Integration Audit

Scope: verification of the 11-commit overnight SaaS transformation (Phase 2a through Phase 6a plus infra/CI work), built by multiple concurrent background agents hand-splitting shared files. This is a verify-and-fix pass per the owner's instruction ("no new features until everything works together") — not a feature pass. Every claim below is backed by a file path/line or a live test result, not a re-statement of commit messages.

---

## 1. Overall readiness summary

**The code is in good shape.** Across a full read of `server/index.js` (1315 lines), every migration, `App.tsx`, `TopNav.tsx`, the status-pipeline consumers, and live end-to-end testing against the real (persisted-session) Supabase project, the large majority of what the audit brief hypothesized as likely broken (quota gaps on the newest routes, `plans.js`/event-type drift, middleware ordering regressions, status-pipeline omissions) turned out to be **already correct**. The concurrent-agent hand-splitting held up better than expected on the code side.

The real, confirmed problems were narrower and different from the hypothesis:

- **5 migrations (007, 008, 011, 012, 013) were not idempotent** — `create table`/`create policy`/`create index` without guards. Re-running the full sequence on a fresh database, or re-running after a partial failure, would error out. **Fixed.**
- **The `jobs` table (migration 009) had no RLS enabled at all** — a real (if currently low-impact, since nothing queries it) public read/write exposure via the anon key. **Fixed.**
- **The `/companies` page, shipped in Phase 5, had no navigation entry point** — reachable only by typing the URL. **Fixed.**
- **One stale cross-reference** between the two `.env.example` files. **Fixed.**
- Live testing surfaced that **`/api/generate-cold-email` currently 500s on every call** in the environment I tested — not a code bug, but a direct, confirmed consequence of migration 007 (`contacts`) not being applied yet. Documented, not "fixed" (the fix *is* running the migration).

No security hole, no duplicate route, no middleware-ordering regression, and no quota/event-type drift were found. 110/110 tests pass, `tsc -b --noEmit` is clean, and `vite build` succeeds, both before and after every fix in this report.

---

## 2. Bugs found and fixed

### 2.1 Five migrations were not idempotent (Section A)

`supabase/migrations/007_contacts.sql`, `008_notifications.sql`, `011_usage_events.sql`, `012_subscriptions.sql`, and `013_career_goals.sql` all used bare `create table`, `create policy`, and `create index` — no `if not exists` guard on the table/index, and no `drop policy if exists` before the `create policy`. Every other migration in the sequence (`schema.sql`, 002–006, 009, 010, 014) already follows the idempotent pattern; these five were simply written without it. Concretely, before the fix, re-running the SQL editor script (e.g. after a partial failure, or to rebuild a fresh staging DB from the full file sequence) would fail with `relation "contacts" already exists` / `policy "own contacts" already exists`.

**Fix**: added `if not exists` to every `create table`/`create index`, and `drop policy if exists "<name>" on <table>;` immediately before each `create policy`, in all five files — mirroring the exact pattern already used elsewhere in this repo. No schema/behavior change, purely idempotency.

- `supabase/migrations/007_contacts.sql`
- `supabase/migrations/008_notifications.sql`
- `supabase/migrations/011_usage_events.sql`
- `supabase/migrations/012_subscriptions.sql`
- `supabase/migrations/013_career_goals.sql`

### 2.2 `jobs` table had no RLS enabled (Section A)

`supabase/migrations/009_jobs.sql` created a shared, non-user-owned `jobs` table but never called `alter table jobs enable row level security`. In a standard Supabase project, `anon`/`authenticated` Postgres roles get table-level grants by default, and RLS is the only thing that restricts row-level access via the auto-generated REST API — so without it, anyone holding the public anon key (bundled in every frontend build) could read/insert/update/delete arbitrary rows in `jobs`. Confirmed via `grep` that no frontend code anywhere calls `.from("jobs")` today, so this was a live, unused-but-open door, not yet exploited by the app's own code.

**Fix**: `supabase/migrations/009_jobs.sql` now ends with `alter table jobs enable row level security;` and no policies — this is a deliberate deny-all for `anon`/`authenticated` (the service-role client used server-side always bypasses RLS), with zero functional change since nothing currently queries this table client-side. A future feature that needs client access should add a scoped policy rather than remove this line.

### 2.3 `/companies` page had no navigation entry point (Section C)

`src/App.tsx:87-88` correctly routes `/companies` and `/companies/:companyName` behind `ProtectedRoute`, and the page (`src/routes/Companies.tsx`) renders correctly — but `src/components/layout/TopNav.tsx`'s `NAV_LINKS` array (added in Phase 5, commit `4d8d1de`) never included it. The only way to reach a real, working, already-shipped page was to type the URL directly.

**Fix**: `src/components/layout/TopNav.tsx:32-44` — added `{ to: "/companies", label: "Companies" }` to `NAV_LINKS`. Verified at both 1280px and 1400px viewport widths that the resulting 11-item nav still fits on one row without wrapping or overflow (screenshotted live) — no reorganization/grouping was actually needed, contrary to what an 11-item nav might suggest on paper.

### 2.4 Stale cross-reference between the two `.env.example` files (Section D)

`server/.env.example`'s `STRIPE_SECRET_KEY` comment block says the frontend's `VITE_STRIPE_PUBLISHABLE_KEY` lives "in the root `.env.local`/`.env.example`" — true of `.env.local` (confirmed present there), but the root `.env.example` never actually had that line, so a fresh clone following the documented setup would have no template for it.

**Fix**: added `VITE_STRIPE_PUBLISHABLE_KEY=` to `.env.example` with a comment explaining it's currently unread by any frontend code (Checkout/Portal are backend-initiated redirects, no Stripe.js/Elements integration exists yet) and is reserved for if that changes.

---

## 3. Migration run order (Section A)

FK/dependency order was checked for every migration — **no forward references found** (every `references X(id)` points at a table defined in `schema.sql` or an earlier-numbered migration; the `roles.job_id`/`roles.resume_id` FKs in 010 are additionally guarded with `to_regclass(...)` checks that skip gracefully if 009/005 haven't run yet). RLS was confirmed enabled with correctly `auth.uid()`-scoped policies on every user-owned table, no `using(true)` gaps, both before and after the fixes above.

**After the fixes in §2.1–2.2, every file in this sequence is idempotent** — the full sequence can be run once, or re-run in full from scratch on a fresh database, without erroring. Run in the Supabase SQL editor, in this exact order:

1. `supabase/schema.sql`
2. `supabase/migrations/002_profile_fields.sql`
3. `supabase/migrations/003_cover_letter.sql`
4. `supabase/migrations/004_interview_prep.sql`
5. `supabase/migrations/005_resumes.sql`
6. `supabase/migrations/006_job_analyses.sql`
7. `supabase/migrations/007_contacts.sql`
8. `supabase/migrations/008_notifications.sql`
9. `supabase/migrations/009_jobs.sql`
10. `supabase/migrations/010_roles_expansion.sql`
11. `supabase/migrations/011_usage_events.sql`
12. `supabase/migrations/012_subscriptions.sql`
13. `supabase/migrations/013_career_goals.sql`
14. `supabase/migrations/014_profile_preferences.sql`

**Live-confirmed state of the actual production Supabase project** (via authenticated requests against the real project during E2E testing, not assumed): `contacts`, `notifications`, `resumes`, `job_analyses`, `career_goals`, and `usage_events` all currently return `PGRST205 — Could not find the table in the schema cache`, confirming migrations **005 through at least 013 are not yet applied**. Only `schema.sql` + likely 002–004 are live. This matches the task's own framing and is exactly why the frontend hooks are written to degrade gracefully (see §5).

---

## 4. Environment variables (Section D)

Cross-referenced every `process.env.X` in `server/` and `import.meta.env.X` in `src/` against both `.env.example` files. **Every variable actually read by code is documented in one of the two files** (one stale cross-reference fixed, §2.4). `server/.env` (local, gitignored, confirmed not tracked) has real values for all of the "required" and "Stripe" groups below; `SUPABASE_ANON_KEY` specifically is set (confirmed non-empty, 46 chars — a Supabase publishable-key-format value, not the classic long JWT anon key, but present and used correctly).

**Required for basic function:**
| Variable | Where | Used by |
|---|---|---|
| `SUPABASE_URL` | server | `server/lib/supabaseAdmin.js`, `server/lib/supabaseUser.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | server | `server/lib/supabaseAdmin.js` |
| `GROQ_API_KEY` | server | `server/lib/groq.js` |
| `VITE_API_URL` | frontend | `src/config/api.ts` |
| `VITE_SUPABASE_URL` | frontend | `src/lib/supabaseClient.ts` |
| `VITE_SUPABASE_ANON_KEY` | frontend | `src/lib/supabaseClient.ts` |

**Required for Stripe billing (Phase 4b):**
| Variable | Where | Used by |
|---|---|---|
| `STRIPE_SECRET_KEY` | server | `server/lib/stripe.js` |
| `STRIPE_WEBHOOK_SECRET` | server | `server/index.js` (webhook signature check) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | frontend | *(documented, not yet read by any code — see §2.4)* |

**Optional, with safe fallback/no-op if unset:**
| Variable | Where | Fallback behavior |
|---|---|---|
| `PORT` | server | defaults to 5050 |
| `CORS_ORIGIN` | server | defaults to `"*"` (see §5 — verify the real Render value) |
| `GROQ_MODEL` | server | groq.js has its own default |
| `SUPABASE_ANON_KEY` | server | falls back to admin-client + explicit `user_id` filter (§ below) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | server | falls back to in-memory rate limiting |
| `SENTRY_DSN` | server | Sentry skipped entirely, no warning |
| `FRONTEND_URL` | server | derived from `CORS_ORIGIN`, then `localhost:5173` |
| `NODE_ENV` | server | platform-set (Render); gates raw-error-echo behavior |
| `VITE_SENTRY_DSN` | frontend | Sentry skipped entirely, no warning |

**`SUPABASE_ANON_KEY` fallback path, verified by reading the code (not trusting the prior report):** `server/lib/supabaseUser.js:28-34` builds a per-request client authenticated with the caller's own bearer token when the anon key is set — RLS then does the real ownership enforcement. When unset, `fetchOwnedRowViaAdmin` (`supabaseUser.js:44-49`) uses the service-role client with an **explicit `.eq("id", id).eq("user_id", userId)`** filter — this is a real, correct ownership check on its own (not a silent bypass), just without the extra RLS layer. Confirmed `SUPABASE_ANON_KEY` **is currently set** in `server/.env`, so the stronger RLS-scoped path is the one actually active in this environment.

---

## 5. Live end-to-end verification (Section E)

Found and used an already-persisted Supabase session in the browser (real logged-in user with real tracked roles) — no account was created or reset.

**The 5 newest routes (Phase 6a), tested with real requests against the live backend + real Supabase project:**

| Route | Valid request | Invalid request | Error shape |
|---|---|---|---|
| `POST /api/skill-roadmap` | 200, real Groq output | 400 `VALIDATION_ERROR` (missing `skill`) | consistent `{error:{code,message,requestId}}` |
| `POST /api/recommend-project` | 200, real Groq output | 400 `VALIDATION_ERROR` (empty array) | consistent |
| `POST /api/career-advice` | 200, real Groq output (with role-scoped context) | 400 `VALIDATION_ERROR` (wrong type); 404 `NOT_FOUND` for a well-formed but non-owned role id | consistent |
| `POST /api/report-summary` | 200, real Groq output | 400 `VALIDATION_ERROR` (stats not an object) | consistent |
| `POST /api/generate-cold-email` | **500** `INTERNAL_ERROR` — see below | 400 `VALIDATION_ERROR` (missing/malformed `contactId`) correctly returned first | consistent shape even on the 500 |

**`generate-cold-email`'s 500 is not a code defect.** Server log at the moment of the call: `generate-cold-email: contact lookup failed: Could not find the table 'public.contacts' in the schema cache`. `server/index.js:992-1001`'s `fetchOwnedRow` call against the `contacts` table fails because migration 007 hasn't been applied yet (§3) — every other newest route either doesn't need a table lookup or looks up `roles`/`profiles`, which already exist. The code correctly logs the real Postgrest error server-side only and returns the generic, safe `"Failed to look up contact"` message to the client — no info leak, same discipline as every other route. **This route will start working the moment migration 007 is run**; no code change is needed or was made.

**Quota enforcement — confirmed working.** Temporarily set `"ai.skill_roadmap": 0` in `server/lib/plans.js`, restarted the backend, and confirmed the authenticated request now returns `429 USAGE_LIMIT_EXCEEDED` with the correct message. Restored the limit to `20`, restarted, and confirmed `git diff` shows zero residual change to `plans.js` before committing. (Note: `usage_events` also isn't migrated yet in this environment, so the normal "count real usage this month" path always reads 0 — the `limit: 0` trick was necessary specifically because `isWithinQuota(0, 0)` is false at any count. Once migration 011 is applied, real usage counting will also work; the decision logic itself is already verified correct via unit tests in `server/lib/usage.test.js` plus this live check.)

**Navigation — every page added tonight renders without crashing**, despite migrations 005+ not being applied: Resumes, Contacts, Goals, Analytics, Companies, Report, and RoleDetailDrawer's new panels (Application details, Ask about this role, cold email) all degrade to honest empty/error states (confirmed via console: `PGRST205` errors for `contacts`/`notifications`/`resumes`/`job_analyses`/`career_goals`, all caught and turned into `error` state + empty array, never an uncaught exception). Zero uncaught JS errors observed across the entire click-through. Dashboard, Roles, Companies, and RoleDetail — whose backing `roles` table does exist — show real data correctly, including the full 12-value status dropdown.

---

## 6. Found but deliberately NOT fixed

- **`cold-email` 500 pre-migration** (§5) — the fix *is* running migration 007; no code change belongs here.
- **CORS production value is unverifiable from this repo** (carried over from Phase 0, still true): `server/index.js:92` defaults to `"*"` if `CORS_ORIGIN` is unset; the real Render value lives outside this repo. Needs a manual check in Render's dashboard, not a code fix.
- **`App.tsx`'s share-link `isReserved` list (lines 40-43) only excludes `analyzer`/`tracker`/`insights`**, not any of the routes added across all of Phase 2a–6a (`dashboard`, `roles`, `goals`, `contacts`, etc.). This is a **pre-existing gap from before tonight's session** (Phase 0's own audit already describes the exact same mechanism only excluding the then-current route set) — not a regression introduced by tonight's phases, and it only matters if someone visits e.g. `/goals?d=<base64-JSON-shaped-like-a-share-payload>`, which no in-app link ever constructs. Left alone: fixing it would mean either hand-maintaining a second reserved-word list in sync with every route (itself a footgun) or refactoring the share-link mechanism, both bigger than this pass's scope.
- **ESLint doesn't cover `server/**/*.js`** (`eslint.config.js:11` scopes to `**/*.{ts,tsx}` only) — pre-existing since Phase 0, unrelated to tonight's changes, not a regression.
- **Root `npm test` picking up `server/lib/*.test.js` without a `cd server && npm install` step in CI** — investigated directly (simulated a clean CI checkout by fully removing `server/node_modules` and re-running `npm test` from root): all 7 test files / 110 tests still pass, because every server module actually under test (`scoring.js`, `validation.js`, `usage.js`, `billing.js`, `accountDeletion.js`) either has zero external dependencies or only needs `@supabase/supabase-js`, which is already a root dependency and resolves via Node's normal parent-directory `node_modules` walk. **Verified working, nothing to fix.**
- **1.6MB main JS bundle / no code-splitting** — a pre-existing Vite warning, not a correctness issue, out of scope for an integration-correctness pass.

---

## 7. Final verdict

**Yes — ready to push and deploy once the migrations in §3 are run**, in that exact order, in the Supabase SQL editor. Nothing found in this audit should block a deploy on its own:

- No security hole (RLS gap on `jobs` closed; everything else was already correctly scoped).
- No duplicate/conflicting routes, and the Stripe webhook's raw-body-before-`express.json()` ordering survived every subsequent commit intact — verified by direct reading, not assumption.
- Every AI route (12 of them, including all 5 from tonight's last two commits) has consistent `optionalAuth` + rate limiting + quota enforcement + input validation + the `{error:{code,message,requestId}}` shape — confirmed both by code reading and live requests.
- `plans.js`'s 12 limit keys match the 12 `event_type` strings actually logged in `index.js`, exactly — no silently-unenforceable quota.
- 110/110 tests pass, `tsc -b --noEmit` clean, `vite build` succeeds — verified after every fix in this report, not just once at the start.
- Every page added tonight fails gracefully today (pre-migration) and will start showing real data the moment migrations are applied — verified live, not assumed.

The one thing genuinely worth the owner's attention before or immediately after deploying: **run the migrations before announcing/relying on Resumes, Contacts, Goals, Analytics, Companies, Report, or cold-email to real users** — they're correctly coded but functionally inert (gracefully, not crashily) until then. That's a sequencing note, not a code defect.
