import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Playwright E2E specs live under e2e/ and are run separately via
    // `npm run test:e2e` (playwright.config.ts) — Vitest's default include
    // glob would otherwise also try to import them as unit tests.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
