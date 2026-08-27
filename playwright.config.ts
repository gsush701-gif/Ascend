import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env.e2e loader (no extra dependency needed just for this) — see
// docs/TESTING.md and e2e/.env.example. Never overrides an already-set
// process.env value (e.g. from CI secrets), and silently no-ops if the
// file doesn't exist, which is the default state of this repo today.
function loadDotEnvE2e() {
  const envPath = path.resolve(__dirname, ".env.e2e");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnvE2e();

/**
 * Playwright E2E config for Ascend.
 *
 * See docs/TESTING.md for the full test-data strategy — short version:
 * this suite runs against a LOCAL dev instance of the app (frontend +
 * backend), started automatically below via `webServer`. It never points at
 * production and never uses the service-role key. Anything that needs a
 * real authenticated Supabase session is gated behind the
 * E2E_TEST_ACCOUNT_EMAIL / E2E_TEST_ACCOUNT_PASSWORD env vars (see
 * e2e/fixtures/env.ts) and calls test.skip() when they're absent, which is
 * the case in this repo out of the box — no test Supabase project is wired
 * up yet.
 */

const FRONTEND_PORT = 5173;
const BACKEND_PORT = 5050;

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 30_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Starts both the Vite dev server (frontend) and the Express API (backend)
  // automatically for local/CI runs. Both are skipped if something is
  // already listening on the port (reuseExistingServer), so `npx playwright
  // test` also works fine against servers you started yourself.
  webServer: [
    {
      command: "npm run dev -- --port 5173 --strictPort",
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm run dev",
      cwd: "./server",
      url: `http://localhost:${BACKEND_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
