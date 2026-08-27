import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/authHelpers";
import { skipIfNoTestAccount } from "./fixtures/env";

/**
 * Career intelligence: goals, analytics, skill roadmap, and job
 * recommendations. All four routes (/goals, /analytics, /analyzer, /jobs)
 * are behind ProtectedRoute, so every test here is gated behind a real
 * test account even where the feature itself needs no other configuration
 * (e.g. the Jobs empty state, which is real today with zero providers
 * wired up — see server/lib/jobProviders/ — but still requires being
 * logged in to reach the page).
 */
test.describe("Career goals", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoTestAccount();
    await loginAsTestUser(page);
  });

  test("create a goal and see it rendered as a card", async ({ page }) => {
    await page.goto("/goals");
    await page.getByRole("button", { name: "Add goal" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "New goal" })).toBeVisible();

    const title = `E2E goal ${Date.now()}`;
    await dialog.getByPlaceholder("e.g. Get a SWE internship").fill(title);
    await dialog.getByRole("button", { name: "Add goal" }).click();

    await expect(page.getByText("Goal added")).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  });
});

test.describe("Application analytics", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoTestAccount();
    await loginAsTestUser(page);
  });

  test("analytics page renders without crashing", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Application analytics" }).or(page.locator("h1"))).toBeVisible();
    // Every breakdown section either shows real bars or an honest
    // "not enough data" message — both are valid, deterministic outcomes
    // depending on how many applications the test account has tracked.
    await expect(page.locator("body")).not.toContainText("undefined");
    await expect(page.locator("body")).not.toContainText("[object Object]");
  });
});

test.describe("Skill roadmap for a gap", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoTestAccount();
    await loginAsTestUser(page);
  });

  test("viewing a missing required skill offers a learning-path roadmap", async ({ page }) => {
    await page.goto("/analyzer");
    await page.getByPlaceholder("Paste the job description here...").fill(
      "We require expert-level Kubernetes and Rust experience for this backend role.",
    );
    await page.getByRole("button", { name: /^Analyze$/ }).click();
    await expect(page.getByText(/Last analyzed/i)).toBeVisible({ timeout: 20_000 });

    const gapPanel = page.getByText("Close your skill gaps");
    // Only renders when there's at least one missing *required* skill —
    // true for this deliberately-unmatched JD against an account with no
    // resume mentioning Kubernetes/Rust, but skip gracefully instead of
    // failing if the test account happens to already have a resume that
    // covers everything.
    test.skip(!(await gapPanel.isVisible().catch(() => false)), "No missing required skills for this account/resume — nothing to test.");

    const firstSkillButton = page.getByRole("button", { name: /Get a learning path/i }).first();
    await firstSkillButton.click();
    // Real Groq call — assert structure (a numbered list of steps), not content.
    await expect(page.locator("ol li").first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("Job recommendations — honest empty state", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoTestAccount();
    await loginAsTestUser(page);
  });

  test("recommendations tab shows a real 'no provider configured' state, not fabricated listings", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Recommendations" })).toBeVisible();
    // This is real, current, and NOT gated on a job provider being
    // configured (server/lib/jobProviders/ defaults to NullJobProvider) —
    // the honest-empty-state text below is the actual product behavior
    // today, not a placeholder for this test.
    await expect(page.getByRole("heading", { name: "No recommendations yet" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/doesn't have a live job-listing provider connected yet/i)).toBeVisible();
  });
});
