import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { TEST_ACCOUNT } from "./env";

/**
 * Shared page-object-ish helpers for the auth forms, so selectors live in
 * one place instead of being duplicated across every spec file.
 */

export async function gotoLogin(page: Page, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
}

export async function gotoSignup(page: Page) {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Start free" })).toBeVisible();
}

export async function fillAndSubmitLogin(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /^Log in$/ }).click();
}

export async function fillAndSubmitSignup(
  page: Page,
  email: string,
  password: string,
  confirmPassword = password,
) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(confirmPassword);
  await page.getByRole("button", { name: /^Get started$/ }).click();
}

/**
 * Logs in with the real configured test account (only ever called after
 * `skipIfNoTestAccount()` has already gated the test) and waits for the
 * redirect off /login to complete.
 */
export async function loginAsTestUser(page: Page) {
  if (!TEST_ACCOUNT.email || !TEST_ACCOUNT.password) {
    throw new Error("loginAsTestUser called without a configured E2E test account");
  }
  await gotoLogin(page);
  await fillAndSubmitLogin(page, TEST_ACCOUNT.email, TEST_ACCOUNT.password);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

export async function logout(page: Page) {
  // TopNav renders a plain "Log out" button (desktop) that calls
  // AuthContext.signOut() directly — see src/components/layout/TopNav.tsx.
  await page.getByRole("button", { name: "Log out" }).first().click();
  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/login", { timeout: 15_000 });
}
