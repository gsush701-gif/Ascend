import { test, expect } from "@playwright/test";

/**
 * Fully public, no-auth, no-backend-secrets-needed flows. These run for
 * real against the local dev server in every environment, including this
 * one — no test Supabase project is required for anything in this file.
 */

test.describe("Landing page", () => {
  test("renders hero content and primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Ascend/i);
    await expect(page.getByRole("link", { name: "Start free" }).first()).toBeVisible();
    // This exact copy appears twice on the landing page (the hero
    // subheading and, verbatim, a section headline further down) — assert
    // presence via .first() rather than requiring uniqueness.
    await expect(
      page.getByText(/Manage every internship role from analysis to outcome/i).first(),
    ).toBeVisible();
  });

  test("Start free CTA navigates to signup", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Start free" }).first().click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: "Start free" })).toBeVisible();
  });
});

test.describe("Not found page", () => {
  test("shows a 404 for an unknown route", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText("404")).toBeVisible();
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("Public shareable profile", () => {
  test("a random/unknown slug renders a plain, non-leaking not-found state", async ({ page }) => {
    // /api/public-profile/:slug (server/index.js) returns 404 for BOTH "no
    // such slug" and "slug exists but is private" — this page must render
    // identically either way. A random slug guarantees the "no such slug"
    // branch deterministically, without needing any real profile data.
    const randomSlug = `e2e-nonexistent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await page.goto(`/u/${randomSlug}`);
    await expect(page.getByRole("heading", { name: "Profile not found" })).toBeVisible();
    await expect(
      page.getByText(/doesn.t point to a public profile/i),
    ).toBeVisible();
    await page.getByRole("link", { name: "Back to Ascend" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("Protected route gating", () => {
  for (const path of ["/dashboard", "/roles", "/analyzer", "/resumes", "/profile", "/admin", "/jobs", "/goals"]) {
    test(`unauthenticated visit to ${path} redirects to /login with a next param`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/\//g, "\\/")}`));
      await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    });
  }
});
