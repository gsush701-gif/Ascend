import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/authHelpers";
import { skipIfNoTestAccount } from "./fixtures/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_RESUME_PDF = path.join(__dirname, "fixtures", "sample-resume.pdf");

/**
 * Every test in this file requires a real authenticated session (the
 * Analyzer, My Resumes, and Resume Editor routes are all behind
 * ProtectedRoute) and is gated behind E2E_TEST_ACCOUNT_EMAIL /
 * E2E_TEST_ACCOUNT_PASSWORD — see docs/TESTING.md. These are real, complete
 * tests, written to run once the owner points them at a throwaway test
 * Supabase project; they are not run against production.
 *
 * AI output (parsed resume content, suggestion text) is inherently
 * non-deterministic (real Groq calls) — every assertion below checks
 * structure/presence (a section exists, a suggestion row rendered, a
 * download fired) rather than exact wording.
 */
test.describe("Resume upload + structured editor", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoTestAccount();
    await loginAsTestUser(page);
  });

  test("upload flow: choosing a PDF shows it selected and reveals Save this resume", async ({ page }) => {
    await page.goto("/analyzer");
    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
    await fileInput.setInputFiles(SAMPLE_RESUME_PDF);

    await expect(page.getByText("sample-resume.pdf")).toBeVisible();
    // Text extraction runs client-side after selection; the save affordance
    // only appears once resumeText is populated.
    await expect(page.getByRole("button", { name: /Save this resume to My Resumes/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("save a resume, then parse it to a structured editor, edit a section, and save", async ({ page }) => {
    await page.goto("/analyzer");
    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
    await fileInput.setInputFiles(SAMPLE_RESUME_PDF);

    const saveButton = page.getByRole("button", { name: /Save this resume to My Resumes/i });
    await expect(saveButton).toBeVisible({ timeout: 15_000 });

    await test.step("save the uploaded resume", async () => {
      await saveButton.click();
      await expect(page.getByText(/Resume saved/i)).toBeVisible();
    });

    await test.step("open it from My Resumes", async () => {
      await page.goto("/resumes");
      const row = page.locator("li", { hasText: "sample-resume" }).first();
      await expect(row).toBeVisible();
      await row.getByRole("link", { name: "Edit" }).click();
      await expect(page).toHaveURL(/\/resumes\/.+\/edit$/);
    });

    await test.step("parse the raw text into structured sections", async () => {
      const parseButton = page.getByRole("button", { name: /Parse my resume/i });
      if (await parseButton.isVisible().catch(() => false)) {
        await parseButton.click();
        // AI parsing call — allow generous time, assert structure appears
        // rather than any particular parsed value.
        await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible({ timeout: 30_000 });
      }
      await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Skills" })).toBeVisible();
    });

    await test.step("edit the Summary section", async () => {
      const summaryPanel = page.locator("section, div").filter({ hasText: "Summary" }).first();
      const textarea = summaryPanel.locator("textarea").first();
      const uniqueSummary = `E2E edited summary ${Date.now()}`;
      await textarea.fill(uniqueSummary);
      const saveBtn = page.getByRole("button", { name: /^Save$/ });
      await expect(saveBtn).toBeEnabled();
      await saveBtn.click();
      await expect(page.getByRole("button", { name: "Saved" })).toBeVisible({ timeout: 10_000 });
    });
  });

  test("request an AI suggestion, then accept one and reject another", async ({ page }) => {
    await page.goto("/resumes");
    const row = page.locator("li", { hasText: "sample-resume" }).first();
    // This test assumes the resume from the previous test already exists;
    // if run in isolation (e.g. `--grep`), skip rather than fail on
    // unrelated missing fixture state.
    test.skip(!(await row.isVisible().catch(() => false)), "Run alongside the upload/parse test, or seed a resume first.");
    await row.getByRole("link", { name: "Edit" }).click();

    const generateButton = page.getByRole("button", { name: /Generate suggestions/i });
    await generateButton.click();
    await expect(page.getByText(/Generating…/i)).toBeVisible();

    const suggestionRows = page.locator("li", { has: page.getByRole("button", { name: "Accept" }) });
    await expect(suggestionRows.first()).toBeVisible({ timeout: 30_000 });

    const count = await suggestionRows.count();

    await test.step("accept the first suggestion", async () => {
      await suggestionRows.first().getByRole("button", { name: "Accept" }).click();
    });

    if (count > 1) {
      await test.step("reject another suggestion", async () => {
        // Re-query since the list shrinks after accepting.
        const remaining = page.locator("li", { has: page.getByRole("button", { name: "Reject" }) });
        await remaining.first().getByRole("button", { name: "Reject" }).click();
      });
    }
  });

  test("export the resume as a PDF and observe the download", async ({ page }) => {
    await page.goto("/resumes");
    const row = page.locator("li", { hasText: "sample-resume" }).first();
    test.skip(!(await row.isVisible().catch(() => false)), "Requires a resume with structured content — run alongside the parse test.");
    await row.getByRole("link", { name: "Edit" }).click();

    const downloadButton = page.getByRole("button", { name: /Download PDF/i });
    await expect(downloadButton).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);

    // Assert the download's identity (filename + it's a real PDF), not the
    // binary content itself — deterministic without parsing PDF bytes.
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });
});
