import { API_BASE } from "../config/api";

/**
 * Product events the backend allowlists (server/index.js, TRACKABLE_EVENT_TYPES).
 * Keep this list in sync with the server — an event type not in both places
 * is silently dropped (client) or rejected with a 400 (server).
 */
export type TrackedEvent =
  | "signup"
  | "resume_uploaded"
  | "analysis_completed"
  | "role_created"
  | "cover_letter_generated"
  | "interview_started";

/**
 * Fire-and-forget product analytics ping to POST /api/track (usage_events
 * table). No auth required — anonymous events are valid. Never throws, never
 * awaited by callers, and never sent with resume/JD/answer content: keep
 * `metadata` to small, non-sensitive shape info only (counts, lengths,
 * booleans), matching the same privacy rule the backend's own AI-route
 * instrumentation follows.
 */
export function logEvent(event: TrackedEvent, metadata?: Record<string, unknown>): void {
  try {
    fetch(`${API_BASE}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: event, metadata }),
      keepalive: true,
    }).catch(() => {
      // Telemetry only — a failed/blocked request must never surface to the user.
    });
  } catch {
    // Some environments (very old browsers, certain test/SSR contexts) may
    // not have fetch or may throw synchronously on keepalive; never let
    // analytics break the actual feature it's instrumenting.
  }
}
