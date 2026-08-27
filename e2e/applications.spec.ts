import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/authHelpers";
import { skipIfNoTestAccount } from "./fixtures/env";

/**
 * Applications (the "roles" tracker) — create, edit, move through the
 * status pipeline, and view the detail drawer. Gated behind a real test
 * account since /roles is a protected route and writes real rows to the
 * `roles` table (RLS-scoped to that account, never the service-role key).
 */
test.describe("Applications pipeline", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoTestAccount();
    await loginAsTestUser(page);
    await page.goto("/roles");
  });

  test("create a role via Quick add", async ({ page }) => {
    const company = `E2E Co ${Date.now()}`;
    const role = `E2E SWE Intern ${Date.now()}`;

    await page.getByRole("button", { name: "Add role" }).click();
    await expect(page.getByRole("heading", { name: "Quick add" })).toBeVisible();
    await page.getByPlaceholder("Company *").fill(company);
    await page.getByPlaceholder(/Role title \*/).fill(role);
    await page.getByRole("button", { name: "Add application" }).click();

    await expect(page.getByText("Role added")).toBeVisible();
    await expect(page.getByText(role)).toBeVisible();
    await expect(page.getByText(company)).toBeVisible();
  });

  test("open the detail drawer, edit fields, and move status through the pipeline", async ({ page }) => {
    const company = `E2E Drawer Co ${Date.now()}`;
    const role = `E2E Drawer Role ${Date.now()}`;

    await page.getByRole("button", { name: "Add role" }).click();
    await page.getByPlaceholder("Company *").fill(company);
    await page.getByPlaceholder(/Role title \*/).fill(role);
    await page.getByRole("button", { name: "Add application" }).click();
    await expect(page.getByText("Role added")).toBeVisible();

    await test.step("open the detail drawer", async () => {
      // The Role/Company cells stop click propagation (they're inline-editable
      // text), so open the drawer via another cell in the row — the
      // alignment/progress cell — which is the row's real click target.
      const row = page.locator("tr", { hasText: role });
      await row.locator("td").nth(2).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("heading", { name: `${role} at ${company}` })).toBeVisible();
    });

    const drawer = page.getByRole("dialog");

    await test.step("edit the Next step and Deadline fields", async () => {
      const nextStepInput = drawer.getByPlaceholder("e.g. Apply by Friday");
      const deadlineInput = drawer.getByPlaceholder("e.g. Feb 15");
      await nextStepInput.fill("Follow up next week");
      await deadlineInput.fill("Dec 1");
      await expect(nextStepInput).toHaveValue("Follow up next week");
      await expect(deadlineInput).toHaveValue("Dec 1");
    });

    await test.step("edit Notes", async () => {
      const notes = drawer.getByPlaceholder("Deadlines, contact, follow-ups...");
      await notes.fill("E2E test note");
      await expect(notes).toHaveValue("E2E test note");
    });

    await test.step("move status through the pipeline", async () => {
      const statusSelect = drawer.locator("select");
      await statusSelect.selectOption("Applied");
      await expect(statusSelect).toHaveValue("Applied");
      await statusSelect.selectOption("Interview");
      await expect(statusSelect).toHaveValue("Interview");
      await statusSelect.selectOption("Offer");
      await expect(statusSelect).toHaveValue("Offer");
    });

    await test.step("close the drawer", async () => {
      await drawer.getByRole("button", { name: "Close" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    });

    // Reflected back in the table row after closing.
    await expect(page.getByText(role)).toBeVisible();
  });
});
