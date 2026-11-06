import { API_BASE } from "../config/api";

let warmed = false;

/**
 * Render's free tier puts the backend to sleep after a quiet spell, and the
 * first request afterwards takes up to a minute. Pinging the cheap /health
 * route as soon as a page opens starts the wake-up while the visitor is still
 * reading, so the real request (fit score, sign-in data) usually finds it awake.
 *
 * Fire-and-forget, once per page load. The reply is never read, so a no-cors
 * request is enough, and any failure is ignored.
 */
export function warmBackend(): void {
  if (warmed) return;
  warmed = true;
  try {
    void fetch(`${API_BASE}/health`, { mode: "no-cors", cache: "no-store" }).catch(() => {});
  } catch {
    // Telemetry-grade: never let a warm-up break the page.
  }
}
