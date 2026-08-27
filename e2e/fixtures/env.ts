/**
 * Test-environment gating for anything that needs a REAL authenticated
 * Supabase session (resume upload/edit/export, ATS check with a saved
 * resume, applications CRUD behind login, billing, career goals, etc.).
 *
 * This repo's production Supabase project must never be used for E2E login
 * flows (see docs/TESTING.md). Until the owner points these env vars at a
 * separate local/test Supabase project + creates one throwaway test
 * account there, every test that needs a real session calls
 * `skipIfNoTestAccount()` and reports as "skipped", not "failed" — these
 * are real, complete tests, just correctly gated rather than faked.
 */
import { test } from "@playwright/test";

export const TEST_ACCOUNT = {
  email: process.env.E2E_TEST_ACCOUNT_EMAIL,
  password: process.env.E2E_TEST_ACCOUNT_PASSWORD,
};

export function hasTestAccount(): boolean {
  return Boolean(TEST_ACCOUNT.email && TEST_ACCOUNT.password);
}

/** Call at the top of a test body (or in a beforeEach) to skip cleanly when no test account is configured. */
export function skipIfNoTestAccount() {
  test.skip(
    !hasTestAccount(),
    "Requires E2E_TEST_ACCOUNT_EMAIL / E2E_TEST_ACCOUNT_PASSWORD pointed at a real test Supabase project — see docs/TESTING.md.",
  );
}

/**
 * Stripe: this project's Stripe integration is already in real test mode
 * (test-mode secret key on the backend), so a full checkout redirect is
 * safe to exercise — but it still requires a logged-in session to reach
 * the "Upgrade to Pro" button, so it's gated the same way.
 */
export function skipIfNoBillingTestEnv() {
  skipIfNoTestAccount();
}
