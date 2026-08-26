# Ascend — Phase 0 Codebase Audit

Scope: honest snapshot of the codebase as it exists on branch `AscendV1` today. Every claim below is backed by a file path and line reference. This is the input to Phase 1 planning, not a spec restatement.

---

## 1. Frontend architecture

**Routing** — `src/App.tsx:67-86`. Single `<Routes>` tree, no nested layouts, no lazy loading (`React.lazy` isn't used anywhere in `src/`). Public routes: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`. Protected routes (wrapped in `ProtectedRoute`): `/dashboard`, `/roles`, `/roles/:id`, `/roles/:id/interview-prep`, `/analyzer`, `/profile`, `/resume-lab`. Two silent redirects exist for old URLs: `/tracker` → `/roles` and `/insights`/`/settings` → `/dashboard`/`/profile` (`App.tsx:80-84`).

`App.tsx:22-55` also does client-side handling of public share links: any first path segment not matching a reserved route, combined with a `?d=<base64>` query param, is decoded as a `SharedProfileData` payload and rendered via `ProfileView` instead of going through the router at all — this bypasses `<Routes>` entirely (see `mainContent` ternary at `App.tsx:57-66`).

**Auth gating** — `src/components/auth/ProtectedRoute.tsx:5-23`. While `AuthContext`'s `loading` is true it shows a spinner; once resolved, an absent `user` redirects to `/login?next=<encoded path>`. No route-level role/permission checks exist beyond "logged in or not" — there is no admin/user distinction anywhere in the frontend.

**Pages** (`src/routes/`, sizes via `wc -l`): `Analyzer.tsx` (708 lines), `Dashboard.tsx` (732), `Landing.tsx` (711), `ResumeLab.tsx` (752), `Roles.tsx` (363), `RoleDetail.tsx` (219), `Profile.tsx` (357), `InterviewPrep.tsx` (336), plus the smaller auth pages. These are large, monolithic route components — most business logic (fetch orchestration, derived state, formatting) lives directly in the route file rather than being pushed into hooks, except where it's been factored out (`useAnalyzer`, `useTracker`).

**Components** — `src/components/` splits into `ui/` (generic primitives: `Button`, `Card`, `Modal`, `Select`, `DarkSelect`, `Tooltip`, etc.), `layout/` (`AppShell.tsx`, `TopNav.tsx`, `PageLayout.tsx`, `PublicShell.tsx`, `PublicNav.tsx`), `dashboard/`, `roles/`, `onboarding/`, and `auth/`. See §9 for a dead component found in `layout/`.

**State management** — no global store (no Redux/Zustand/Jotai). State is: (a) React Context for auth only (`src/context/AuthContext.tsx`), (b) local `useState`/`useEffect` per route/hook, (c) Supabase Postgres as the actual source of truth for persisted data, fetched directly from components via `@supabase/supabase-js`, (d) derived analytics computed client-side in pure functions — `src/lib/dashboardStats.ts` (579 lines, 24 exported functions such as `getFunnelCounts`, `getApplicationStreak`, `getResponseRate`, `getReadinessScores`) that all operate on an in-memory `TrackerItem[]` array already fetched by `useTracker`. There is no caching layer (no React Query/SWR) — every route that needs roles data calls `useTracker` independently, which means multiple components on the same page each run their own Supabase fetch.

**Frontend → Supabase vs. → backend API** — Ascend uses two disjoint data paths that don't overlap:
- Direct Supabase client calls (RLS-protected) for all CRUD on `roles` and `profiles`: `src/features/tracker/hooks/useTracker.ts:70-196` (select/insert/update/delete on `roles`), `src/lib/profile.ts:41-71` (select/update on `profiles`). No backend involvement at all for this data.
- HTTP calls to the Express backend (`API_BASE`, `src/config/api.ts:1-2`) exclusively for anything that needs the Groq API key or server-side PDF parsing: `/analyze`, `/api/improve-bullet`, `/api/improve-resume`, `/api/improve-linkedin`, `/api/generate-cover-letter`, `/api/generate-interview-questions`, `/api/interview-feedback`, `/api/account/delete`.

This is a reasonable and common split (RLS handles authorization for direct DB access; the backend exists only where a secret or CPU-heavy operation is required) and is applied consistently — no component reaches for the Supabase service-role key or attempts a privileged operation client-side.

---

## 2. Backend architecture

Single file, `server/index.js` (620 lines), Express 5. No router modules, no controllers/services split — every route is defined inline.

**Middleware, in registration order** (`server/index.js:39-60`):
1. `app.set("trust proxy", 1)` — line 39. See §8 for why this matters and its history.
2. `helmet({ contentSecurityPolicy: false })` — line 45. CSP disabled deliberately (commented as: this is a JSON API with no HTML to protect); HSTS/no-sniff/frameguard etc. remain on.
3. `morgan("tiny")` — line 51, one log line per request.
4. `cors(...)` — lines 53-59. `corsOrigin = process.env.CORS_ORIGIN || "*"`; if set, it's split on commas into an explicit allow-list, methods restricted to `["GET", "POST"]`.
5. `express.json({ limit: "5mb" })` — line 60.

**Rate limiters** (`server/index.js:69-86`): two `express-rate-limit` instances — `aiLimiter` (60 requests / 15 min per IP) applied to every AI-backed route including `/analyze`, and `accountLimiter` (10 / 15 min per IP) applied only to `/api/account/delete`. Both are in-memory (single-instance only, documented as such in the comment at line 63-65 — would need a shared store like Redis if the server ever scales beyond one instance). Coverage check: every mutating or Groq-calling route in the file has one of these two limiters attached (verified route-by-route below); nothing costed is unlimited.

**Multer upload config** (`server/index.js:89-97`): memory storage, `fileSize: 5MB`, `files: 1`, `fields: 5`, `fieldSize: 64KB`. MIME check on the uploaded file happens in the route handler itself (`req.file.mimetype !== "application/pdf"`, line 218-223), not in multer's `fileFilter` — functionally equivalent since it's checked before any use, but note this is a full-buffer read (5MB) into memory before rejection, not a stream-level filter.

**Full route inventory**:
| Route | Method | Rate limit | Auth | Purpose |
|---|---|---|---|---|
| `/health` | GET | none | none | liveness check |
| `/` | GET | none | none | version string |
| `/analyze` | POST | `aiLimiter` | none | resume+JD skill match (see §6) |
| `/api/improve-bullet` | POST | `aiLimiter` | `optionalAuth` | Groq bullet rewrite, saved to DB if logged in |
| `/api/improve-resume` | POST | `aiLimiter` | `optionalAuth` | Groq full-resume critique |
| `/api/improve-linkedin` | POST | `aiLimiter` | `optionalAuth` | Groq headline/About rewrite |
| `/api/generate-cover-letter` | POST | `aiLimiter` | `optionalAuth` | Groq cover letter |
| `/api/generate-interview-questions` | POST | `aiLimiter` | `optionalAuth` | Groq mock-interview questions |
| `/api/interview-feedback` | POST | `aiLimiter` | `optionalAuth` | Groq answer critique |
| `/api/account/delete` | POST | `accountLimiter` | `optionalAuth`, hard-requires `req.user` | deletes the Supabase Auth user |

None of the `/api/*` routes require auth to function (all use `optionalAuth`, which never blocks — see §4) except `/api/account/delete`, which checks `if (!req.user) return res.status(401)` itself at line 583-585. This means every AI feature is usable by a fully anonymous caller, gated only by the 60/15min per-IP limiter — a deliberate product choice (keeps the tool usable pre-signup) but worth flagging explicitly as the actual security boundary: IP-based rate limiting, not authentication.

**Error handling** (`server/index.js:604-615`): a catch-all Express error handler logs `err.stack` server-side but only ever returns `{ error: "Internal server error" }` or, for Multer errors, `{ error: "Upload rejected: <message>" }` (Multer's own messages are canned/safe, e.g. "File too large"). Individual route handlers follow the same discipline — e.g. `/api/improve-bullet`'s catch block (line 349-359) only echoes `err.message` when `err.name === "GroqNotConfiguredError"` (a fixed, developer-authored string) or when `NODE_ENV !== "production"`; otherwise it returns a generic message. This pattern is repeated identically across all five `/api/*` AI routes. **No raw error text or stack trace reaches the client in production** — this is handled correctly and consistently.

---

## 3. Database architecture

Three tables, defined in `supabase/schema.sql` plus three additive migrations.

**`supabase/schema.sql:4-8` — `profiles`**: `id uuid PK references auth.users(id) on delete cascade`, `full_name text`, `created_at`. Migration `002_profile_fields.sql:4-8` adds `major`, `target_role`, `graduation_year` (all nullable text). No other migration touches this table.

**`supabase/schema.sql:10-25` — `roles`**: `id uuid PK default gen_random_uuid()`, `user_id uuid not null references auth.users(id) on delete cascade`, `company text not null`, `role text not null`, `status text not null default 'Wishlist'`, `alignment int not null default 0`, `next_step`, `job_description`, `notes`, `deadline text` (not a real `date`/`timestamptz` — stored as free text), `priority text`, `report_snapshot jsonb`, `created_at`, `updated_at`. Migrations add `cover_letter text` (`003_cover_letter.sql:4-5`) and `interview_prep jsonb` (`004_interview_prep.sql:4-5`). Note: `status` and `priority` are unconstrained `text` columns — there is no `check` constraint or enum restricting them to the values the frontend uses (`Wishlist`/`Applied`/`Interview`/`Offer`/`Rejected`), so any authenticated client (including the browser extension, which inserts directly) could write an arbitrary string into either.

**`supabase/schema.sql:27-36` — `resume_improvements`**: `id`, `user_id`, `input text not null`, `improved text not null`, `why`, `stack`, `impact`, `created_at`. Populated only by `server/index.js:332-346` (`/api/improve-bullet`, fire-and-forget insert when `req.user` is present) — nothing else in the codebase writes to or reads from this table, meaning the data it stores is currently write-only (see §7, this is directly related to the Resume Lab localStorage gap).

**Indexes** (`schema.sql:38-39`): `roles_user_id_idx` and `resume_improvements_user_id_idx`, both single-column on `user_id`. No index on `roles.status`, `roles.updated_at`, or `roles.company` — fine at current scale (per-user row counts are small), but the `useTracker.ts:73` query pattern (`order('updated_at', ...)`) will eventually want a composite `(user_id, updated_at)` index once table sizes grow. `profiles` has no non-PK index (fine, single-row lookups by PK only).

**RLS**: enabled on all three tables (`schema.sql:41-43`). All three policies are identically shaped and correct — `using (auth.uid() = id)` / `using (auth.uid() = user_id)` `with check` clauses matching (`schema.sql:45-55`). **No `using (true)` or otherwise-open policy exists anywhere in the schema or migrations.** This is a clean, correctly-scoped RLS setup — genuinely good news, not a gap.

**Trigger**: `handle_new_user()` (`schema.sql:58-70`) auto-inserts a `profiles` row on `auth.users` insert, `security definer`, `on conflict (id) do nothing` — correctly idempotent.

**Numbering gap**: migrations start at `002` with no `001` file — `schema.sql` itself is the implicit baseline; not a bug, just worth knowing so Phase 1 doesn't go looking for a missing file.

**No migration ever adds a `down`/rollback statement** — these are forward-only `alter table ... add column if not exists` scripts, applied by hand in the Supabase SQL editor per the README (`README.md:32`, `README.md:39-43`). There is no migration tool (no Supabase CLI migration folder convention, no Prisma/Knex) — just plain `.sql` files a human runs manually. This is fine for the current single-developer pace but will not scale to a team or to CI-driven deploys.

---

## 4. Authentication

**Wiring**: `src/lib/supabaseClient.ts:15-18` creates a single Supabase client from `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. If either is unset, it logs a `console.warn` (`supabaseClient.ts:8-13`) and falls back to placeholder values rather than throwing — the app will still boot but every Supabase call will fail at runtime. Not a security issue (anon key is meant to be public), but a rough edge for local setup.

**Session handling**: `src/context/AuthContext.tsx:26-38`. On mount, `supabase.auth.getSession()` seeds state, then `onAuthStateChange` keeps it in sync; `loading` flips to `false` after the first resolution. `signIn`/`signUp`/`signOut` (`AuthContext.tsx:40-52`) are thin wrappers returning `{ error: string | null }`. Session persistence/refresh is entirely delegated to `@supabase/supabase-js`'s default behavior (localStorage-backed, auto-refresh) — no custom token handling in the app.

**Password reset flow**: `src/routes/ForgotPassword.tsx` and `src/routes/ResetPassword.tsx` exist as dedicated routes (both public, `App.tsx:72-73`) — standard Supabase magic-link-style reset, not custom-built.

**`optionalAuth` behavior on invalid/missing token** (`server/middleware/auth.js:8-28`): `req.user` is set to `null` unconditionally at the top (line 9). If there's no `Authorization: Bearer` header, or Supabase isn't configured server-side, it calls `next()` immediately (line 14-16) — no rejection. If a token is present, it calls `supabaseAdmin.auth.getUser(token)`; on any error (invalid/expired token) or exception, it logs a warning (line 24) and still calls `next()` with `req.user` left `null`. **The net effect: an invalid or missing token never blocks a request — it silently downgrades to "anonymous."** This is correct and intentional for the AI routes (documented in the comment at `auth.js:3-7`: "Never blocks the request — AI endpoints stay usable logged-out"), but it means every route using `optionalAuth` must itself decide whether `req.user` is required (as `/api/account/delete` correctly does at `index.js:583-585`).

---

## 5. AI architecture (Groq)

`server/lib/groq.js` (253 lines). `isGroqConfigured` (line 6, exported line 250) is `Boolean(GROQ_API_KEY)`; every exported function throws `GroqNotConfiguredError` (503) if the key is absent (`chatJson`, line 34), and the frontend is documented to fall back to an offline/template result when that happens (README.md:45, and `ResumeLab.tsx` imports `getBulletImprovementDetails` from `features/analyzer/utils.ts` as exactly that offline fallback — see §6/local template logic).

Seven Groq-calling functions, all funneled through `chatJson()` (`groq.js:33-60`, `response_format: { type: "json_object" }`, `temperature: 0.6`). Per-function summary:

| Function | Route | Rate-limited | Auth | Input cap | Anti-fabrication in prompt |
|---|---|---|---|---|---|
| `improveBullet` | `/api/improve-bullet` | yes (`aiLimiter`) | optional | 600 chars (`index.js:326`) | Yes — explicit |
| `improveResume` | `/api/improve-resume` | yes | optional | 50,000 chars resume / 20,000 JD (`index.js:377-381`) | Yes — explicit |
| `improveLinkedInSection` | `/api/improve-linkedin` | yes | optional | 300 (headline) / 600 (about) chars (`index.js:422-424`) | Yes — explicit, plus a post-hoc length guard (`groq.js:140-142`) |
| `generateCoverLetter` | `/api/generate-cover-letter` | yes | optional | 50,000 / 20,000 chars | Yes — explicit |
| `generateInterviewQuestions` | `/api/generate-interview-questions` | yes | optional | 20,000 chars JD | N/A (no candidate facts involved) |
| `generateInterviewFeedback` | `/api/interview-feedback` | yes | optional | question 1,000 / answer 10–4,000 chars | N/A |
| `summarizeAlignment` | (called from inside `/analyze`, not its own route) | inherits `/analyze`'s `aiLimiter` | none (used pre-auth) | resume 8,000 / JD 3,000 chars (sliced in-function, `groq.js:236`) | Implicit (works off an already-computed score) |

**Anti-fabrication is a real, consistently-applied constraint, not just a claim.** Direct quotes:
- `improveBullet` system prompt (`groq.js:70-73`): *"Do not fabricate employers, dates, or specific proprietary numbers presented as fact; phrase invented metrics as natural resume style (e.g. "reduced load time by ~30%") rather than claiming certainty about the user's real results."*
- `improveResume` (`groq.js:97`): *"Only use content that appears in the resume text; do not invent employers or dates. Quantified metrics you add should read as natural resume phrasing, not as claims of verified fact."*
- `generateCoverLetter` (`groq.js:159`): *"Do not fabricate employers, dates, titles, or credentials that don't appear in the resume."*
- `generateInterviewQuestions` (`groq.js:190`): *"Do not invent employers, companies, or credentials for the candidate."*

The one place this is genuinely a soft spot rather than a hard constraint: the model is explicitly permitted to *add a plausible invented number* to a bullet ("include a plausible quantified outcome... only if it's a reasonable inference — otherwise suggest where to add one," `groq.js:72`) — i.e. the system deliberately allows fabricated-but-plausible metrics as a resume-writing convention (rewrite "improved X" into "improved X by ~30%"), while telling the model to phrase it as suggestion-style rather than fact. Whether that's acceptable product behavior is a judgment call, not a bug — but it's worth flagging explicitly since a plausible-sounding fabricated "30%" on a real resume is exactly the failure mode a skeptical reviewer would ask about. It is at least consistently phrased as a stylistic convention across every prompt, not left ambiguous.

Every AI route validates `typeof x === "string"` before calling `.trim()`/`.length` on request fields (e.g. `index.js:319`, `364-369`, `398-404`, `444-455`, `495-501`, `536-544`), so malformed JSON bodies return a clean 400 rather than a 500 crash.

---

## 6. The skill/fit-score analysis engine — bug verification

**The real scoring path is entirely server-side, in `server/index.js`, not `src/features/analyzer/utils.ts` or `src/lib/parseJd.ts`.** This distinction matters: there are actually *two* separate, non-communicating skill-matching implementations in this codebase, doing different things:

1. **`src/lib/parseJd.ts`** — client-only, used only in "JD-only mode" (`useAnalyzer.ts:111-116`, no resume uploaded yet). Matches against `COMMON_SKILLS` (`parseJd.ts:14-21`) using a properly escaped, **word-boundary regex**: `new RegExp("\\b" + skill + "\\b", "i")` (`parseJd.ts:38`). This one does *not* have the substring-match bugs described below — `\bJava\b` will not match inside "JavaScript" because there's no word boundary between "Java" and "Script" (both are `\w` characters). This code path never touches a resume and never produces the actual alignment/coverage numbers shown after a real analysis.

2. **`server/index.js:101-155`** — the real engine, used by `POST /analyze` whenever a resume is uploaded, which is what actually produces the `Report` (`alignment`, `coverage`, `skills[]`) the rest of the app (Roles tracker snapshots, Dashboard) is built on. This one uses **plain substring matching**, not word boundaries:
   ```js
   function extractSkills(text) {
     const t = norm(text);
     const hits = [];
     for (const { canonical, patterns } of SKILL_ENTRIES) {
       const matched = patterns.some((p) => {
         const key = norm(p);
         return key.length > 0 && t.includes(key);   // <-- index.js:150
       });
       if (matched) hits.push(canonical);
     }
     return unique(hits);
   }
   ```

**Verifying each claimed bug against this actual code:**

- **"java" matches inside "javascript" — REAL.** `SKILL_ENTRIES` has separate entries `{ canonical: "java", patterns: ["java"] }` and `{ canonical: "javascript", patterns: ["javascript"] }` (`index.js:103-104`). Given input text containing only "JavaScript" (no standalone "Java"), `norm()` lowercases it to `"javascript"`, and `t.includes("java")` evaluates to `true` because "java" is literally the first four characters of "javascript". So a resume or JD that only ever says "JavaScript" will register a hit for the **separate, distinct** "java" skill entry it never actually mentioned. Confirmed real, and it's specifically bad here because Java and JavaScript are unrelated languages that recruiters do care about distinguishing.

- **"git" matches inside "digital" — REAL.** `{ canonical: "git", patterns: ["git"] }` (`index.js:119`). `"digital"` contains the literal substring `"git"` at index 2 (`di-git-al`). `t.includes("git")` on any text containing "digital" (e.g. "digital marketing experience", "digital transformation") returns `true`, incorrectly crediting a Git skill hit.

- **"api" matches generic unrelated text — REAL, and the broadest of the three.** `{ canonical: "rest api", patterns: ["rest api", "rest apis", "api"] }` (`index.js:109`) includes bare `"api"` as a matching pattern. `"api"` is a substring of many common unrelated words: "capital" (c-**api**-tal), "rapid" (r-**api**-d), "capitalize", "apiary". Any JD or resume containing any of these words — with zero actual API experience or mention — will register a "rest api" skill hit. Of the three, this is the one most likely to distort a real score, since "capital"/"rapid" are common in ordinary business/tech prose.

**Is there a required-vs-preferred classification? No, not in the real scoring path.** `server/index.js`'s `extractSkills`/`/analyze` treats every matched skill identically — there is no concept of "must-have" vs. "nice-to-have" anywhere in the backend. The only place anything resembling this exists is `src/lib/parseJd.ts:44-46`:
```js
const split = Math.min(6, Math.max(4, Math.ceil(allFound.length / 2)));
coreSkills.push(...allFound.slice(0, split));
preferredSkills.push(...allFound.slice(split));
```
This splits whatever skills were found into two buckets purely by **array position/count** (first ~half of matches found, in `COMMON_SKILLS` iteration order) — it does not read the JD for language like "required"/"must have" vs. "nice to have"/"preferred". It's cosmetic bucketing for the JD-only display mode, not a semantic classification, and it isn't wired into the real `/analyze` score at all.

**Is the match score a simple ratio, or something more nuanced?** Simple ratio with one flat penalty, confirmed from `server/index.js:270-277`:
```js
const hits = skills.filter((x) => x.status === "hit").length;
const total = Math.max(skills.length, 1);
const coverage = Math.round((hits / total) * 100);
const signals = missingSignals(resumeText);          // deployment / metrics / GitHub presence
const penalty = Math.min(signals.length * 5, 15);      // capped at 15 points
const alignment = Math.max(0, coverage - penalty);
```
`coverage` is `hits / total_JD_skills_found`, unweighted (a matched "python" counts exactly the same as a matched "api"). `alignment` is that same coverage minus a flat penalty (5 points per missing "signal" — deployment, quantified numbers, GitHub link — capped at 15) with no floor beyond 0. There is no skill-importance weighting, no seniority adjustment, no partial credit for related-but-not-exact skills.

**Net assessment**: all three specifically-claimed false-positive bugs are real and reproducible from the actual matching code, and they're all attributable to the same root cause — `extractSkills()` in `server/index.js` uses `String.includes()` for substring containment instead of a word-boundary regex, even though the *other*, unused-for-real-scoring parser in this same codebase (`parseJd.ts`) already demonstrates the correct pattern. Fixing `index.js:150` to use `\b`-anchored regex matching (mirroring `parseJd.ts:38`) would resolve all three in one change. Separately, there is no required/preferred distinction in the real score at all, and the score itself is a flat, unweighted ratio.

---

## 7. localStorage / sessionStorage usage

No `sessionStorage` usage anywhere in `src/`. Every `localStorage` call, grouped by whether it's legitimate per-browser UI state or actual user data that should be database-backed:

**(a) Legitimate per-browser UI state — fine to keep:**
- `src/lib/onboarding.ts:7,13,21,29,35,43` — `internos_resume_lab_used_v1`, `internos_checklist_dismissed_v1`, `internos_checklist_complete_shown_v1`: dismissed-banner/seen-once flags. Correctly ephemeral.
- `src/routes/Roles.tsx:45,56,63,95,96` — `internos_roles_sort`, `internos_roles_status_filter`: remembered table sort/filter. Fine as a UI convenience; losing it on a new device is a non-issue.
- `src/features/analyzer/hooks/useAnalyzer.ts:73` (`LAST_RESUME_KEY`, `internos_last_resume_v1`) — remembers the last-uploaded filename only (not the file itself), purely cosmetic.

**(b) Real user-generated content stored only in localStorage — actual gaps:**
- `src/features/analyzer/hooks/useAnalyzer.ts:47,54` (`HISTORY_KEY` = `internos_alignment_history_v1`, defined `src/types/analyzer.ts:51`) — the Analyzer's alignment-score history (`{id, alignment, createdAt}[]`, capped at 20 entries, `useAnalyzer.ts:151`). This is real analytical history about the user's job-fit trend over time, used to compute `trendBonus` in `getInterviewProbability` (`features/analyzer/utils.ts:268-275`) — and it evaporates on cache clear or a second device, with no server-side equivalent at all.
- `src/routes/ResumeLab.tsx:32,40,46` (`HISTORY_KEY` = `internos_resume_lab_history_v1`, capped at 20, `ResumeLab.tsx:20-21`) — the user's full history of AI bullet-improvement results (`{input, result, createdAt}[]`). This is a genuine double-gap: the backend *does* persist an authenticated user's improve-bullet calls to the `resume_improvements` table (`server/index.js:332-346`), but nothing in the frontend ever reads that table back — `ResumeLab.tsx`'s own history UI is sourced exclusively from localStorage (`loadHistory()`, line 30-36), regardless of login state. So a logged-in user's bullet-improvement history is silently written to Postgres and then never shown to them from there; what they actually see is the separate, device-local copy. This is exactly the kind of feature described as "already handled" that isn't actually wired end-to-end.
- `src/lib/shareProfile.ts:8,24,30,38` (`SHARE_PAYLOAD_KEY`, `SLUG_KEY`) — the payload backing the public profile-share links (`/{slug}?d=<base64>`, decoded in `App.tsx:38-49`). Since the actual shareable data is embedded in the URL itself (base64 JSON), the localStorage copy here is just a local staging cache to pre-fill the share form — not a security or durability issue, but it means "share slug" is also not a real user-owned, server-tracked resource (anyone can mint any slug locally; there's no uniqueness or ownership check anywhere since it's not backed by a table).

---

## 8. Security posture

- **RLS**: no gaps found — see §3. Every policy is scoped to `auth.uid()`.
- **Service-role key exposure**: never reaches the client. It's read only in `server/lib/supabaseAdmin.js:3-4` from `process.env.SUPABASE_SERVICE_ROLE_KEY`, used to construct a server-only client (`autoRefreshToken: false, persistSession: false`, line 15-18). `git ls-files | grep env` confirms only `.env.example` and `server/.env.example` are tracked; the real `.env`/`server/.env` files are gitignored (`.gitignore:12-13`) and were never committed. `grep`ing `src/` for `SERVICE_ROLE`/`service_role` returns nothing — the frontend has no path to this key.
- **CORS**: `server/index.js:53-59`. Defaults to `"*"` if `CORS_ORIGIN` is unset; the local `server/.env` (untracked, dev-only) sets it to `http://localhost:5173`. The production value lives in Render's dashboard environment config, which is outside this repo's visibility — **Phase 1 should explicitly verify in Render that `CORS_ORIGIN` is set to the real frontend origin and not left at the wildcard default**, since the code's own fallback is permissive by design.
- **Rate limiter coverage**: complete for AI/mutating routes — see the route table in §2. No AI-calling or account-mutating route is missing a limiter.
- **Input validation**: consistently applied across all `/api/*` routes — type checks, trim, min/max length caps per field (documented per-route in §5's table and visible throughout `index.js:317-580`). `/analyze` separately validates JD length (20-20,000 chars, `index.js:224-233`), file presence and MIME type (`index.js:213-223`), and extracted-text minimum length (`index.js:251-256`, guards against scanned/image PDFs with no real text).
- **Error message sanitization**: handled correctly and consistently — see §2. No route leaks `err.message`/stack traces in production except the deliberately-safe `GroqNotConfiguredError` case.
- **File upload validation**: multer memory storage, 5MB/1 file/5 fields cap (`index.js:89-97`); MIME check in-handler (`index.js:218-223`); PDF parsing via `pdfjs-dist` in `server/lib/pdfText.js` with `isEvalSupported: false` explicitly set to work around **CVE-2024-4367** (arbitrary JS execution via crafted PDF embedded actions) — this is documented inline (`pdfText.js:1-10`) as a deliberate, informed mitigation for a pinned older `pdfjs-dist` version, not an oversight. A `MAX_PAGES = 25` cap (`pdfText.js:26`) additionally guards against a small-file/many-page DoS (thousands of near-empty pages inside a few MB). This is a well-reasoned, already-hardened upload path, not a gap.
- **`trust proxy`**: currently `app.set("trust proxy", 1)` at `server/index.js:39` — correctly set for Render's single reverse-proxy hop. Confirmed via `git log`: this was a **real historical bug**, fixed in commit `19a7fc2` ("Fix rate limiter IP detection behind Render's reverse proxy") — before that fix, `express-rate-limit` was bucketing every user under one shared IP key, effectively disabling per-user rate limiting. The fix is correctly in place today; no regression found.
- **No schema constraint on `roles.status`/`roles.priority`** (see §3) — any client with a valid session (including the browser extension) can write an arbitrary string into either column, since RLS only checks row ownership, not value shape. Low severity today (nothing renders it unsafely — it's plain text in a table cell) but worth a `check` constraint before those fields feed into anything more structured (e.g. status-based automation/analytics in the spec).

---

## 9. Existing bugs / technical debt

- **Dead component — `src/components/layout/Navbar.tsx`.** Not imported anywhere in the codebase (`AppShell.tsx:2` and `PageLayout.tsx:1` both import `TopNav.tsx` instead, which is the component actually rendered). This orphaned file additionally contains a **broken nav link**: `Navbar.tsx:32-44` links to `/landing`, a route that does not exist in `App.tsx` (only `/` maps to `Landing`) — if this component were ever re-wired in, that link would resolve to the catch-all `NotFound` page. This is the same class of orphaned-navigation bug the repo has had before.
- **Dead route + components — `src/routes/Tracker.tsx`.** `App.tsx:80` redirects `/tracker` → `/roles` unconditionally, so this route file (67 lines) is unreachable through any live navigation, along with the three components it exclusively imports: `src/features/tracker/components/TrackerTable.tsx`, `TrackerSummaryCards.tsx`, and `SavedReportModal.tsx`. (Note: `src/features/tracker/hooks/useTracker.ts` is **not** dead — it's the live data hook used by `Roles.tsx`, `RoleDetail.tsx`, `Dashboard.tsx`, `Analyzer.tsx`, `InterviewPrep.tsx`, and `Profile.tsx`; only the route file and its three UI-only components are orphaned. The naming — "Tracker" hook powering a "Roles" feature — is a leftover from a rename that was done incompletely.)
- **`resume_improvements` table is write-only** (§3, §7) — populated server-side, never read by any frontend code. Combined with `ResumeLab.tsx`'s separate localStorage-only history, this is a half-finished persistence feature: the backend was built assuming the frontend would eventually read this table for cross-device history, and that half was never done.
- **ESLint: 31 errors, 4 warnings** on a clean `npx eslint .` run against the current tree (config: `eslint.config.js`, includes `eslint-plugin-react-hooks` v7's newer rules). Breakdown:
  - 7 instances of `react-hooks/set-state-in-effect` ("calling setState synchronously within an effect can trigger cascading renders") across `src/App.tsx:47`, `src/components/QuickAddModal.tsx:30`, `src/components/onboarding/OnboardingChecklist.tsx:37`, `src/lib/profile.ts:35`, `src/routes/Analyzer.tsx:91`, `src/routes/Dashboard.tsx:94`, `src/routes/Profile.tsx:305`, `src/routes/Roles.tsx:83`.
  - 8 `no-empty` errors (empty `catch {}` blocks swallowing localStorage errors silently) in `src/lib/shareProfile.ts:18,25,32,39`, `src/routes/ResumeLab.tsx:34,41,47`, `src/routes/Roles.tsx:51,58,66,97`.
  - 1 `Cannot access refs during render` error in `src/components/ui/DarkSelect.tsx:54-58` (a `useRef(() => {...}).current` pattern that reads `ref.current` during the render phase).
  - 1 `react-refresh/only-export-components` error in `src/components/roles/StatusPill.tsx:4`.
  - 4 `react-hooks/exhaustive-deps` warnings (missing effect dependencies) in `Analyzer.tsx:98,107` and `OnboardingModal.tsx:30`.
  None of these are currently causing visible breakage (React tolerates set-state-in-effect today; it's a forward-compat warning), but they're real, itemized debt, not hypothetical.
- **TypeScript: clean.** `tsconfig.app.json:16` has `"strict": true` (plus `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` all on). Running `npx tsc -b --noEmit` against the current tree produces **zero errors**. Strictness is genuinely on and genuinely passing — no gap here.
- **No TODO/FIXME/XXX comments** found anywhere in `src/` or `server/` (excluding `node_modules`) — either a very clean backlog discipline or (more likely given the scope of missing features in §12) debt is tracked outside the code entirely.

---

## 10. Testing

**There is no test infrastructure at all.** `package.json` (root) has no test runner configured — `scripts` only contains `dev`, `build`, `lint`, `preview` (no `test` script exists). `server/package.json` likewise has no test script. Searching both `src/` and `server/` for `*.test.*`/`*.spec.*` files returns zero matches outside of `node_modules` (the only hits are inside third-party packages like `pstree.remy` and `simple-update-notifier`, which are not part of this codebase). No Jest, Vitest, React Testing Library, Playwright, or Cypress dependency exists in either `package.json`. **Zero automated tests of any kind currently protect this codebase.**

---

## 11. CI/CD

**No `.github/workflows/` directory exists in this repository.** There is no CI of any kind — no automated lint/build/test gate on push or PR, no automated deploy pipeline defined in-repo. Whatever happens on push to `main`/`AscendV1` today is either manual or configured entirely on Render's side (auto-deploy-on-push is a Render dashboard setting, not something visible in this repo).

---

## 12. Missing SaaS features vs. the target spec

Confirmed absent (searched `src/` and `server/` for related keywords — zero matches for all of the below beyond incidental word-usage like "recruiter" appearing in UI copy):

- **Billing/Stripe**: no `stripe` dependency in either `package.json`, no billing/subscription/plan code or table anywhere.
- **Usage quotas**: no per-user quota system — the only throttle is the flat per-IP `express-rate-limit` (§2), which is not user-aware and resets per IP, not per account.
- **Admin dashboard**: no admin routes, no role/permission system beyond "logged in or not" (§1), no way to view other users' data.
- **Recruiter CRM**: no recruiter-facing tables, routes, or UI of any kind — `Report.roleTitle` and copy referencing "recruiters" (§6, `features/analyzer/utils.ts`) are just candidate-facing framing text, not a recruiter feature.
- **GitHub integration**: no OAuth flow, no GitHub API calls anywhere in `src/` or `server/`. "GitHub" is only ever a *keyword the resume-strength heuristic looks for* (`features/analyzer/utils.ts:345-347`, a regex for `github.com` / the word "github" in resume text) — not an actual integration.
- **Job discovery**: no job-board scraping/search backend. The only adjacent feature is the browser extension (`extension/`), which captures one job posting at a time from a page the user is already viewing (LinkedIn/Indeed) — not a discovery/search feature.
- **Resume versioning**: `roles.report_snapshot` (jsonb) stores one snapshot per tracked role at analysis time, and `resume_improvements` logs individual bullet edits (write-only, §7/§9) — there is no actual versioned "resume documents" concept (no resume file storage, no diffing, no named versions).
- **Notifications**: no email/push notification system. Resend is named in the audit brief but does not appear as a dependency in either `package.json`, nor is there any `resend`/email-sending code anywhere in `server/` — **Resend is not currently integrated at all**, despite being listed as part of the stack in the task framing.
- **Career goals / application analytics**: partially exists — `src/lib/dashboardStats.ts` (579 lines, §1) computes a genuinely substantial set of derived analytics (funnel counts, application streak, response rate, alignment trend, upcoming deadlines, readiness scores) purely client-side from the `roles` table already in memory. This is real, working functionality, not a stub — it's just entirely derived/computed rather than being its own first-class feature with dedicated storage.
- **Voice interviews**: `InterviewPrep.tsx` + `/api/generate-interview-questions` + `/api/interview-feedback` implement **text-based** mock interview practice (question generation + typed-answer critique) — there is no audio/voice capture, speech-to-text, or voice-based interaction anywhere in the code.

---

## 13. Deployment

- **No `render.yaml`** exists anywhere in the repo — build/start commands and environment variables for the two Render services (frontend static site + backend API) are configured entirely through Render's dashboard, not tracked in version control. This repo alone cannot reconstruct the production deploy configuration.
- **Build commands** are only inferable indirectly: root `package.json:6` (`"build": "tsc -b && vite build"`) for the frontend, `server/package.json` (`"start": "node index.js"`) for the backend. The frontend's fallback `API_BASE` (`src/config/api.ts:2`, `https://ascend-1-6lyv.onrender.com`) reveals the backend's actual Render service hostname is distinct from the frontend's (`ascend-app-60ef.onrender.com`), confirming two separate Render services.
- **Environment variables**: `.env.example` (root, `VITE_API_URL`/`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) and `server/.env.example` (`PORT`/`CORS_ORIGIN`/`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`GROQ_API_KEY`/`GROQ_MODEL`) are both tracked and both correctly contain only placeholder values with explanatory comments (e.g. `server/.env.example` explicitly warns "SUPABASE_SERVICE_ROLE_KEY is secret — never expose it to the frontend"). Real `.env`/`server/.env`/`.env.local` files are all gitignored (`.gitignore:12-13`) and confirmed absent from `git ls-files`.
- **Gitignored vs. tracked**: `.gitignore` excludes `node_modules`, `dist`, `*.local`, `.env`/`server/.env`, and `.claude/` (local dev tooling config). `dist/` exists on disk (build output) but is correctly excluded from tracking.
- **Browser extension** (`extension/`) is a separate, self-contained Manifest V3 build (its own `package.json`, `build.js` using esbuild) not wired into the main app's build or deploy pipeline at all — it has to be built and loaded manually per its own `README.md`. It uses the same public Supabase anon key as the web app (`extension/src/config.js:8-11`, explicitly commented as safe-by-design since RLS is the real protection) and writes directly to the `roles` table client-side, mirroring `addManualTrackerItem`'s column shape (per its own README).

---

## Findings summary

### CRITICAL
*(actively broken or a real security hole in production right now)*

None found. RLS is correctly scoped everywhere, the service-role key never reaches the client, `trust proxy` is correctly set, and error responses don't leak internals. There is no active security hole or broken-in-production issue identified in this audit.

### HIGH

1. **Skill-matching false positives in the real `/analyze` scoring engine** (`server/index.js:144-155`, specifically line 150's `t.includes(key)`). Confirmed real, reproducible false-positive matches: "java" hits on any text containing "javascript"; "git" hits on any text containing "digital"; "api" hits on common unrelated words like "capital"/"rapid". This directly corrupts the headline alignment/coverage score the entire product is built around. Fix is localized: switch to word-boundary regex matching, mirroring the already-correct pattern in `src/lib/parseJd.ts:38`.
2. **No required-vs-preferred skill weighting in the real score.** `/analyze`'s scoring treats every matched skill identically and applies no JD-derived importance signal (`server/index.js:270-277`); the only "core vs. preferred" split in the codebase (`parseJd.ts:44-46`) is a cosmetic array-position split in an unrelated, JD-only display path, not wired into the real score at all.
3. **`ResumeLab` history is a dead-end for logged-in users.** The backend persists authenticated `/api/improve-bullet` calls to `resume_improvements` (`server/index.js:332-346`), but no frontend code ever reads that table — the visible history is sourced only from localStorage (`ResumeLab.tsx:30-36`), so it's lost on cache clear/new device even for paying/logged-in users, while a parallel copy silently accumulates, unused, in Postgres.
4. **Zero automated tests and zero CI** (§10, §11). For a product taking real production traffic with a large planned expansion ahead, there is currently no safety net catching regressions before or after deploy.

### MEDIUM

5. **CORS production value is unverified from the repo.** The code defaults to `"*"` when `CORS_ORIGIN` is unset (`server/index.js:53`); the actual production value lives only in Render's dashboard config, outside this repo's visibility — needs manual confirmation, not a code fix.
6. **`roles.status`/`roles.priority` have no `check` constraint** (`supabase/schema.sql:15,21`) — any authenticated client (including the extension) can write an arbitrary string into either, bypassing the frontend's fixed option lists.
7. **31 ESLint errors** (§9), predominantly `set-state-in-effect` (7) and empty `catch` blocks silently swallowing localStorage failures (8) — not currently breaking anything visibly, but real, itemized code-health debt across `App.tsx`, `Analyzer.tsx`, `Dashboard.tsx`, `Profile.tsx`, `Roles.tsx`, and others.
8. **Two dead/orphaned UI surfaces** (§9): `src/components/layout/Navbar.tsx` (unused, and its one live link target `/landing` doesn't exist as a route), and `src/routes/Tracker.tsx` + its three exclusive child components (unreachable since `/tracker` redirects to `/roles`).
9. **No shared cache/dedup layer for Supabase reads** — every route independently calls `useTracker`/`useProfile`, so multiple components on one page (e.g. Dashboard) each issue their own fetch for the same data (§1).

### LOW

10. **Alignment history (`internos_alignment_history_v1`) is localStorage-only**, feeding into `getInterviewProbability`'s trend bonus (`features/analyzer/utils.ts:268-275`) — lost across devices/cache clears, unlike the roles/profile data which is properly DB-backed.
11. **`DarkSelect.tsx:54-58`** reads a ref's `.current` during render (flagged by ESLint as an anti-pattern) — works today but is fragile under React's stricter future rendering guarantees.
12. **No migration tooling** — `supabase/migrations/*.sql` are plain forward-only scripts applied by hand (§3); fine solo, won't scale to a team without adopting the Supabase CLI's migration workflow or similar.
13. **In-memory rate limiters** (`server/index.js:63-65`, explicitly commented as single-instance-only) will silently stop providing real protection the moment the backend is scaled to more than one Render instance.

### FUTURE
*(not bugs — SaaS features the spec wants that simply don't exist yet, confirmed absent per §12)*

14. Billing/Stripe/subscriptions — none.
15. Per-user usage quotas — none (only flat per-IP rate limiting exists).
16. Admin dashboard / any admin-vs-user role distinction — none.
17. Recruiter CRM — none.
18. GitHub integration (OAuth/API) — none; "GitHub" is only a resume-text keyword heuristic today.
19. Job discovery/search — none (only single-posting capture via the browser extension).
20. Real resume versioning (named versions, diffing, file storage) — none; only per-role JSON snapshots and a write-only improvement log exist today.
21. Notifications (email/push) — none; Resend is not actually integrated in `server/` despite being named in the wider product context.
22. Voice-based mock interviews — none; current interview prep is text-only (typed Q&A + critique).
