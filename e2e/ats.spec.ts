import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/authHelpers";
import { skipIfNoTestAccount } from "./fixtures/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_RESUME_PDF = path.join(__dirname, "fixtures", "sample-resume.pdf");

const SAMPLE_JD = `
We are hiring a Software Engineering Intern.
Required: Python, JavaScript, React, SQL, Git.
Preferred: AWS, Docker, REST APIs.
You will build and deploy full-stack web applications and work with a team
of engineers to ship features end to end.
`;

/**
 * ATS Checker (server/lib/scoring.js's computeDetailedAtsAnalysis via
 * POST /api/ats-check) — gated behind a real test account since /analyzer
 * is a protected route and the panel only renders after a real /analyze
 * call. The score itself is deterministic given fixed inputs (no AI call
 * involved), but this suite still doesn't assert exact numbers since the
 * scoring heuristics may legitimately change — it asserts the breakdown
 * UI renders with real structure.
 */
test.describe("ATS compatibility check", () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoTestAccount();
    await loginAsTestUser(page);
  });

  test("submitting a resume + job description renders a score breakdown", async ({ page }) => {
    await page.goto("/analyzer");

    await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(SAMPLE_RESUME_PDF);
    await expect(page.getByText("sample-resume.pdf")).toBeVisible();

    await page.getByPlaceholder("Paste the job description here...").fill(SAMPLE_JD);
    await page.getByRole("button", { name: /^Analyze$/ }).click();

    // Real backend skill-match scoring — no AI involved in /analyze's core
    // score, so this resolves quickly and deterministically once the
    // request completes.
    await expect(page.getByText(/Last analyzed/i)).toBeVisible({ timeout: 20_000 });

    const runCheckButton = page.getByRole("button", { name: /Run detailed ATS check/i });
    await expect(runCheckButton).toBeVisible();
    await runCheckButton.click();

    await expect(page.getByText("Overall ATS score")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Keyword match")).toBeVisible();
    await expect(page.getByText("Formatting")).toBeVisible();
    await expect(page.getByText("Experience relevance")).toBeVisible();
    await expect(page.getByText("Skills match")).toBeVisible();
  });
});
