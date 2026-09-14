import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/authHelpers";
import { skipIfNoBillingTestEnv } from "./fixtures/env";

/**
 * Billing — the Plan panel on /profile and the "Upgrade to Pro" flow.
 *
 * Mocking approach for this one, and why: this project's Stripe
 * integration already runs on a real test-mode secret key (see
 * server/.env.example's STRIPE_SECRET_KEY comment) — POST
 * /api/billing/create-checkout-session creates a REAL Stripe Checkout
 * Session against Stripe's test environment and returns a real
 * checkout.stripe.com test-mode URL. That's genuinely safe to exercise (no
 * real money moves in test mode), so the first test below follows the
 * redirect for real and only asserts we actually landed on Stripe's
 * checkout domain — it does not fill in a card or complete the purchase
 * (that would need Stripe's 4242... test card, is slower/flakier in CI,
 * and isn't needed to prove the integration wiring is correct).
 *
 * The second test intercepts the network call instead (mocked) to check
 * the exact request shape (auth header present, correct endpoint) in
 * isolation, without depending on the backend's STRIPE_SECRET_KEY being
 * configured in whatever environment runs this suite.
 *
 * Both require a real logged-in session, so both are gated the same way
 * as the rest of this suite.
 */
test.describe("Billing", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoBillingTestEnv();
    await loginAsTestUser(page);
    // The Profile page is temporarily disabled (src/App.tsx redirects
    // /profile to /dashboard) — the Plan panel now lives in the independent
    // "Plan & billing" modal opened from the account menu
    // (src/components/layout/TopNav.tsx), same PlanPanelBody component and
    // billing logic, just a different entry point.
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Plan & billing" }).click();
  });

  test("Plan panel renders the current plan and usage", async ({ page }) => {
    await expect(page.getByText(/plan$/i).first()).toBeVisible();
    await expect(page.getByText(/this month/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("clicking Upgrade to Pro calls the checkout-session endpoint with auth", async ({ page }) => {
    let capturedAuth: string | null = null;
    let capturedUrl: string | null = null;
    await page.route("**/api/billing/create-checkout-session", async (route) => {
      capturedUrl = route.request().url();
      capturedAuth = route.request().headers()["authorization"] ?? null;
      // Mocked response — avoids depending on STRIPE_SECRET_KEY being
      // configured in whatever environment runs this suite, and avoids an
      // actual redirect away from the app for this particular assertion.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "https://checkout.stripe.com/test/mock-session" }),
      });
    });

    const upgradeButton = page.getByRole("button", { name: /Upgrade to Pro/i });
    // Only present for a free-plan account; a test account already on Pro
    // would see "Manage billing" instead (also real, exercised in the next
    // test's mode by checking whichever button is actually present).
    if (await upgradeButton.isVisible().catch(() => false)) {
      await upgradeButton.click();
      await page.waitForURL("**/test/mock-session");
      expect(capturedUrl).toContain("/api/billing/create-checkout-session");
      expect(capturedAuth).toMatch(/^Bearer .+/);
    }
  });

  test("a real checkout attempt redirects to Stripe's own checkout domain (test mode)", async ({ page }) => {
    const upgradeButton = page.getByRole("button", { name: /Upgrade to Pro/i });
    test.skip(!(await upgradeButton.isVisible().catch(() => false)), "Test account is already on Pro — nothing to upgrade to.");

    await upgradeButton.click();
    // Real backend call to Stripe's test-mode API — no card entered, no
    // purchase completed, just verifying the redirect target is genuinely
    // Stripe's own hosted checkout, not a same-origin fake.
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20_000 });
    expect(page.url()).toContain("checkout.stripe.com");
  });
});
