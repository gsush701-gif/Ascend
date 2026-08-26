// --- Central plan/pricing/quota configuration (Phase 4a) ---
//
// Single source of truth for what each plan includes. There is no Stripe
// integration yet (that's a later task, once real API keys exist) and no
// `subscriptions` row is backfilled for existing users — every user is
// implicitly on `free` until a row exists for them in `subscriptions`
// (supabase/migrations/012_subscriptions.sql) with `status = 'active'`.
// See server/lib/usage.js for the lookup/fallback logic that consumes this.
//
// Limit keys are the EXACT `usage_events.event_type` strings this server
// actually records — see the `callGroq(req, "<event type>", ...)` call
// sites in server/index.js. Do not invent new key names here; if a route's
// event type changes, update it in both places.
//
// Note: `/analyze`'s Groq-backed value-add is the layered AI summary
// (`groq.summarizeAlignment`, logged as "ai.analyze_summary") — the
// deterministic skill-match report itself never calls Groq and is not
// quota-gated. A free user who runs out of AI-summary quota for the month
// still gets their full deterministic report; they just stop getting the
// extra AI-written summary layered on top, mirroring how that summary
// already silently no-ops today when Groq isn't configured or the call
// fails (see the try/catch around it in server/index.js's /analyze route).
const PLANS = {
  free: {
    name: "Free",
    priceMonthly: 0, // cents
    limits: {
      "ai.analyze_summary": 20,
      "ai.improve_bullet": 30,
      "ai.improve_resume": 5,
      "ai.generate_cover_letter": 10,
      "ai.generate_interview_questions": 10,
      "ai.interview_feedback": 20,
      "ai.improve_linkedin": 10,
    },
  },
  pro: {
    name: "Pro",
    priceMonthly: 900, // cents, i.e. $9.00 — a placeholder price, not a real
    // business decision.
    // Stripe Price id for this plan's recurring monthly price (Phase 4b).
    // Filled in automatically by server/scripts/setup-stripe-plans.js, which
    // creates (or reuses) a matching Stripe Product+Price and writes the
    // resulting price id back into this exact field — this stays the single
    // source of truth for both the price definition (priceMonthly above) and
    // which live Stripe object represents it (this field). Re-run that
    // script any time priceMonthly changes here, then it creates a new price
    // (Stripe prices are immutable) and updates this field to match.
    stripePriceId: "price_1U8drIC7X9ixl0QrsvwwjEDE",
    limits: {
      "ai.analyze_summary": 200,
      "ai.improve_bullet": 300,
      "ai.improve_resume": 50,
      "ai.generate_cover_letter": 100,
      "ai.generate_interview_questions": 100,
      "ai.interview_feedback": 200,
      "ai.improve_linkedin": 100,
    },
  },
};

const DEFAULT_PLAN = "free";

// Human-readable labels for each quota-limited operation, shared between any
// server-side messaging and the frontend's usage-vs-limit display so the two
// never drift into different wording for the same event type.
const USAGE_LABELS = {
  "ai.analyze_summary": "AI resume analyses",
  "ai.improve_bullet": "Bullet rewrites",
  "ai.improve_resume": "Full resume reviews",
  "ai.generate_cover_letter": "Cover letters",
  "ai.generate_interview_questions": "Interview question sets",
  "ai.interview_feedback": "Interview answer critiques",
  "ai.improve_linkedin": "LinkedIn rewrites",
};

/** Returns the plan config for a plan key, falling back to `free` for an unknown/missing key. */
function getPlan(planKey) {
  return PLANS[planKey] || PLANS[DEFAULT_PLAN];
}

module.exports = { PLANS, DEFAULT_PLAN, USAGE_LABELS, getPlan };
