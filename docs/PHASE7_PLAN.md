# Phase 7 — Remaining feature completion plan

Based on a fresh inspection (2026-08-27): no TODO/FIXME/stub markers exist anywhere in `src/` or `server/` — last night's work is genuinely complete, not placeholder. No PDF-generation library exists yet (`pdfjs-dist` is parse-only). No Playwright, Resend SDK, TOTP, or OAuth libraries exist yet. The shareable-profile system is confirmed 100% localStorage + base64-URL based (`src/lib/shareProfile.ts`), exactly as the earlier audit described — a real gap, not yet touched.

## Execution order (per owner's spec, unchanged)

1. Resume Editor — structured resume data (JSONB on `resumes`), AI suggestions table, section components, accept/reject/edit.
2. ATS Checker — explainable score, reuses `server/lib/scoring.js` conventions, clearly labeled as Ascend's own analysis.
3. PDF Export — new dependency needed (evaluating `pdf-lib` vs `@react-pdf/renderer` for template support + text-selectability), multiple templates.
4. Cover Letter Versioning — new `cover_letter_versions` table, replaces the single `roles.cover_letter` text field's one-per-role limitation without breaking existing data.
5. Database-backed Shareable Profiles — new `public_profiles` table with a unique slug, replaces `shareProfile.ts` entirely.
6. Admin Dashboard — env-var email allowlist for admin access (no new roles/auth system), reuses `usage_events`/`subscriptions`/existing tables.
7. Automated Weekly Reports — needs `RESEND_API_KEY` (not currently held by the app — Supabase Auth's SMTP config isn't accessible to app code) and a scheduler. No paid Render Cron Job needed: a GitHub Actions scheduled workflow calling a secret-protected endpoint is the no-new-cost path.
8. Job Discovery architecture — provider interface only, no real listings, no scraping.
9. GitHub integration architecture — behind env vars, no fake data.
10. Google/GitHub OAuth + MFA — OAuth needs the owner's own app registrations (flagged, deferred); TOTP MFA is achievable now, and Supabase Auth has native MFA support worth using instead of a custom implementation.
11. Playwright E2E — after the above features exist to test.
12. Voice interview architecture — last, browser-native Web Speech API (no paid STT account needed) behind a feature flag, or a clean provider abstraction if that's not viable.

## Hard blockers requiring the owner (flagged now, not silently skipped later)

- Google OAuth app credentials, GitHub OAuth app credentials (item 10, partially item 9).
- A real job-listing data provider/API (item 8) — architecture only until one exists.
- `RESEND_API_KEY` for app-level (non-Auth) email sending (item 7).

Everything else in the list is achievable without new external accounts.
