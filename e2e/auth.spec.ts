import { test, expect } from "@playwright/test";
import { fillAndSubmitLogin, fillAndSubmitSignup, gotoLogin, gotoSignup, loginAsTestUser, logout } from "./fixtures/authHelpers";
import { skipIfNoTestAccount } from "./fixtures/env";

test.describe("Signup form", () => {
  test("renders email/password fields and OAuth options", async ({ page }) => {
    await gotoSignup(page);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "GitHub" })).toBeVisible();
    // Scoped to <main> — PublicNav (the top bar) also has its own "Log in"
    // link, so an unscoped locator matches both.
    await expect(page.getByRole("main").getByRole("link", { name: "Log in" })).toBeVisible();
  });

  test("rejects a password shorter than 6 characters", async ({ page }) => {
    await gotoSignup(page);
    await fillAndSubmitSignup(page, `e2e-${Date.now()}@example.com`, "abc");
    await expect(page.getByText("Password must be at least 6 characters.")).toBeVisible();
    // Must not have attempted to move past the form (no confirmation screen).
    await expect(page.getByRole("heading", { name: "Start free" })).toBeVisible();
  });

  test("rejects mismatched password confirmation", async ({ page }) => {
    await gotoSignup(page);
    await fillAndSubmitSignup(page, `e2e-${Date.now()}@example.com`, "correcthorse1", "differenthorse2");
    await expect(page.getByText("Passwords don't match.")).toBeVisible();
  });

  // Deliberately NOT testing "valid signup creates an account" here — this
  // repo's local dev instance points at the real production Supabase
  // project unless a separate test project is configured (see
  // docs/TESTING.md). Creating real accounts against production from an
  // automated suite is a hard rule this project has repeatedly established
  // and this suite must not violate it, even for a "happy path" test.
});

test.describe("Login form", () => {
  test("renders email/password fields, forgot-password link, and OAuth options", async ({ page }) => {
    await gotoLogin(page);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "GitHub" })).toBeVisible();
    // Scoped to <main> — PublicNav (the top bar) also has its own "Start
    // free" link, so an unscoped locator matches both.
    await expect(page.getByRole("main").getByRole("link", { name: "Start free" })).toBeVisible();
  });

  test("blocks submission with empty required fields (native HTML5 validation)", async ({ page }) => {
    await gotoLogin(page);
    // Both inputs carry a real `required` attribute (and email is also
    // type="email"), so the browser's own constraint validation blocks
    // submission — and Login.tsx's own JS handler never runs — before
    // either field is filled in. (Login.tsx does have its own
    // `!email.trim() || !password` check with its own message, but with
    // `required` on both inputs it's unreachable through real user
    // interaction: no value can satisfy `required` on either field while
    // still being falsy/whitespace-only by the time the handler runs. This
    // test covers the validation behavior a real user actually hits.)
    await page.getByRole("button", { name: /^Log in$/ }).click();
    await expect(page).toHaveURL(/\/login$/);
    const emailValid = await page.getByLabel("Email").evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(emailValid).toBe(false);
  });

  test("shows an error for invalid credentials without crashing the form", async ({ page }) => {
    await gotoLogin(page);
    await fillAndSubmitLogin(page, `nonexistent-e2e-${Date.now()}@example.com`, "wrong-password-123");
    // Asserted generically (some visible error text), not an exact message:
    // against this repo's local dev Supabase config (no VITE_SUPABASE_URL
    // set — see docs/TESTING.md) the failure is a client/network error, not
    // Supabase's real "Invalid login credentials" message; against a real
    // test Supabase project it would be the latter. Either way, the UI
    // contract under test is "a wrong login shows a visible error and
    // leaves the form usable", which is true in both cases.
    const errorBanner = page.locator("form div.text-red-700, form p.text-red-700").first();
    await expect(errorBanner).toBeVisible({ timeout: 15_000 });
    await expect(errorBanner).not.toHaveText("");
    // Form must still be usable, not stuck disabled forever.
    await expect(page.getByRole("button", { name: /^Log in$/ })).toBeEnabled();
  });

  test("Google OAuth button redirects to Supabase's authorize endpoint", async ({ page }) => {
    await gotoLogin(page);
    let capturedUrl: string | null = null;
    await page.route("**/auth/v1/authorize**", async (route) => {
      capturedUrl = route.request().url();
      await route.abort();
    });
    await page.getByRole("button", { name: "Google" }).click();
    await expect.poll(() => capturedUrl, { timeout: 5_000 }).not.toBeNull();
    expect(capturedUrl).toContain("provider=google");
  });

  test("GitHub OAuth button redirects to Supabase's authorize endpoint", async ({ page }) => {
    await gotoLogin(page);
    let capturedUrl: string | null = null;
    await page.route("**/auth/v1/authorize**", async (route) => {
      capturedUrl = route.request().url();
      await route.abort();
    });
    await page.getByRole("button", { name: "GitHub" }).click();
    await expect.poll(() => capturedUrl, { timeout: 5_000 }).not.toBeNull();
    expect(capturedUrl).toContain("provider=github");
  });
  // Deliberately not completing either OAuth flow — that requires real
  // Google/GitHub OAuth app registrations in the Supabase dashboard, which
  // per docs/PHASE7_PLAN.md is an explicit hard blocker for the owner, not
  // something this suite can or should fake.
});

test.describe("Logout", () => {
  test("signing out returns to a logged-out state", async ({ page }) => {
    skipIfNoTestAccount();
    await loginAsTestUser(page);
    await expect(page.getByRole("button", { name: "Log out" }).first()).toBeVisible();
    await logout(page);
    // A previously-protected route should now bounce back to /login.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
