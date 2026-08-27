# Testing

## Unit tests (Vitest)

`npm test` runs the Vitest suite (`vitest run`) — fast, no network, no
external services. This is the suite CI/local pre-push checks should always
be able to run with zero setup.

## End-to-end tests (Playwright)

`npm run test:e2e` runs the Playwright suite under `e2e/`. Unlike the unit
tests, this drives a real browser against a real running instance of the
app (frontend + backend), so it needs a bit more context to run safely.

### What it starts automatically

`playwright.config.ts`'s `webServer` array starts both halves of the app
for you before the first test runs (and reuses them if they're already
running locally):

- the Vite dev server (`npm run dev` at the repo root), on port 5173
- the Express API (`npm run dev` inside `server/`), on port 5050, which
  needs `server/.env` populated the same way it would be for normal local
  development (see `server/.env.example`)

If you already have both running (e.g. two terminals with `npm run dev`),
`npx playwright test` just uses them — `reuseExistingServer` is on for local
runs.

### Test data strategy — read this before running the gated tests

**This suite must never create real accounts against Ascend's production
Supabase project, and never uses the Supabase service-role key to fabricate
test data.** Both are hard rules already established repeatedly across this
project's development. E2E tests that need a real login are a genuine
tension against that rule, so it's resolved like this:

- **Public/no-auth tests run for real, right now, against your local dev
  server** — the landing page, 404 handling, the public-profile "not found"
  state for a random slug, signup/login form validation, invalid-login
  error display, OAuth button presence and click-triggers-redirect, and the
  redirect-to-login behavior for every protected route. None of these
  create an account or touch real user data. `e2e/public.spec.ts` and
  `e2e/auth.spec.ts` contain these.

- **Everything that needs a real logged-in session — resume upload/parse/
  edit/suggestions/export, ATS check, applications CRUD, career goals,
  analytics, the skill-roadmap helper, job recommendations, billing —
  is written as a real, complete test, but gated behind two environment
  variables:**

  ```
  E2E_TEST_ACCOUNT_EMAIL=...
  E2E_TEST_ACCOUNT_PASSWORD=...
  ```

  Every such test calls `skipIfNoTestAccount()` (see
  `e2e/fixtures/env.ts`) as its first line, which turns it into a clean
  Playwright **skip** (not a failure, not a fake pass) when these aren't
  set — which is the state of this repo right now. Nothing in this suite
  will ever attempt to sign up a throwaway account on the fly against
  whatever Supabase project the app is pointed at.

### What you need to do to unlock the gated tests

1. **Create a separate Supabase project for testing** — a free-tier project
   is fine. Do not reuse the production project. Run `supabase/schema.sql`
   and every file in `supabase/migrations/` against it, the same way you set
   up the real one (see the root `README.md`).
2. **Point your local dev servers at that test project** for the duration
   of an E2E run:
   - root `.env` (or `.env.local`): `VITE_SUPABASE_URL` /
     `VITE_SUPABASE_ANON_KEY` from the test project.
   - `server/.env`: `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (and
     ideally `SUPABASE_ANON_KEY`) from the test project. **Do not point
     this at production while running E2E tests against it** — the backend
     has no way to distinguish an E2E run from a real request. Keeping a
     second `server/.env.e2e-test` file you swap in only for test runs (or
     a separate git worktree/checkout used only for testing) is a
     reasonable way to avoid ever mixing this up.
   - `GROQ_API_KEY` can stay the same key you already use — it's not
     project-specific and the tests that hit it (resume parsing,
     suggestions, skill roadmap) already treat its output as
     non-deterministic content, asserting structure only.
   - `STRIPE_SECRET_KEY` — this project's Stripe integration is already
     wired to a **test-mode** secret key convention (see
     `server/.env.example`), so the existing key works as-is; no new Stripe
     setup needed for `e2e/billing.spec.ts`.
3. **Create exactly one throwaway account** on that test project (via the
   app's real signup form, once) and set:
   ```
   # repo root, gitignored — copy from e2e/.env.example
   .env.e2e
   ```
   with that account's email/password. `playwright.config.ts` loads this
   file automatically (a tiny built-in loader, no new dependency) without
   overriding any variable already set in your shell/CI secrets.
4. Run `npm run test:e2e`.

None of this is required to run the ungated tests in `e2e/public.spec.ts`
and most of `e2e/auth.spec.ts` — those work today, against the app exactly
as currently configured.

### Stripe/billing specifically

`e2e/billing.spec.ts` takes the approach the owner's spec asked for
explicitly: since this project's Stripe integration already runs on a real
**test-mode** secret key, a real Checkout Session redirect is safe to
exercise end-to-end (no card is ever entered, no purchase is completed —
the test only asserts the redirect lands on `checkout.stripe.com`). A
second test mocks the `/api/billing/create-checkout-session` network call
at the Playwright level to check the request shape (auth header, endpoint)
in isolation, so that assertion doesn't depend on `STRIPE_SECRET_KEY` being
configured in whatever environment runs the suite.

### Determinism

- No test asserts exact AI-generated wording (resume parsing, suggestions,
  the skill roadmap, cover letters) — only that the expected structure
  renders (a list of steps, a suggestion row with Accept/Edit/Reject
  buttons, a rendered score breakdown). Real Groq output is non-deterministic
  by nature and this suite treats it that way.
- No arbitrary `sleep`s — every wait is a Playwright auto-waiting
  assertion (`expect(...).toBeVisible()`, `page.waitForURL(...)`,
  `page.waitForEvent("download")`, etc.), with generous but bounded
  timeouts on the handful of steps that hit a real AI call.
- Tests create their own uniquely-named data (`E2E ... ${Date.now()}`
  company/role/goal titles) so they don't collide with each other or with
  real data already in the test account, and don't depend on run order.

### What's out of scope

- Actually completing a Google/GitHub OAuth login — that needs real OAuth
  app registrations in the Supabase dashboard (a flagged, owner-only
  blocker per `docs/PHASE7_PLAN.md`); the suite only verifies the button
  triggers the correct redirect to Supabase's `/auth/v1/authorize`.
- Voice interviews, GitHub repo-import, and real job-listing search all
  degrade to explicit "not configured" states in this app today (no fake
  data anywhere) and aren't separately re-tested beyond the honest-empty-state
  coverage already included for Jobs.
- MFA (TOTP) enrollment/challenge flows are not covered by this initial
  suite — enrolling a real TOTP factor needs either a real authenticator
  or programmatically generating TOTP codes in-test, which is a reasonable
  follow-up but was left out to keep this suite's first pass focused on the
  owner's stated priority list.
