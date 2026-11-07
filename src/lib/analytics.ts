import { API_BASE } from "../config/api";
import { supabase } from "./supabaseClient";

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
  | "interview_started"
  | "try_viewed"
  | "try_analysis_completed"
  | "try_signup_clicked"
  | "advisor_plan_viewed"
  | "advisor_item_clicked"
  | "advisor_item_dismissed"
  | "advisor_job_tracked"
  | "internships_viewed"
  | "internships_cta_clicked";

const VISITOR_KEY = "ascend.vid";

/**
 * A random id kept in this browser so the admin page can count distinct
 * visitors to the logged-out /try page. It is not tied to a person or account
 * and is never sent anywhere except our own /api/track.
 */
export function getVisitorId(): string | undefined {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/**
 * Fire-and-forget product analytics ping to POST /api/track (usage_events
 * table). Auth is optional — anonymous events are valid — but signed-in events
 * carry the user's token so they count toward the admin funnel. Never throws, never
 * awaited by callers, and never sent with resume/JD/answer content: keep
 * `metadata` to small, non-sensitive shape info only (counts, lengths,
 * booleans), matching the same privacy rule the backend's own AI-route
 * instrumentation follows.
 */
export function logEvent(event: TrackedEvent, metadata?: Record<string, unknown>): void {
  void send(event, metadata);
}

async function send(event: TrackedEvent, metadata?: Record<string, unknown>): Promise<void> {
  try {
    // Attach the signed-in user's token, if any, so the server can tie the
    // event to an account — the admin funnel (GET /api/admin/funnel) counts
    // distinct users per step, which is impossible with anonymous events.
    // Never blocks or breaks the caller: any failure just sends it anonymously.
    let token: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch {
      token = undefined;
    }
    await fetch(`${API_BASE}/api/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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
