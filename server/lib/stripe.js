const Stripe = require("stripe");

/**
 * Stripe client, mirroring supabaseAdmin.js's "configured or null" pattern:
 * if STRIPE_SECRET_KEY isn't set, every billing route degrades to a clean
 * 503 rather than the process crashing on require() (matches how this app
 * already treats Supabase/Groq being unconfigured in local/dev setups).
 */
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const configured = Boolean(STRIPE_SECRET_KEY);

if (!configured) {
  console.warn("[stripe] STRIPE_SECRET_KEY not set — billing routes will return 503.");
}

// No explicit apiVersion pin — let the SDK use the version it ships pinned
// to (stripe-node always sends a fixed, tested API version per release)
// rather than risk this file drifting out of sync with the installed
// package's actual supported version string.
const stripe = configured ? new Stripe(STRIPE_SECRET_KEY) : null;

/**
 * "live" for a live-mode key (sk_live_... / rk_live_...), "test" for a
 * test-mode key, "unconfigured" when there's none. Only the key's prefix is
 * ever looked at or logged, never the key itself.
 */
function detectStripeMode(key) {
  if (typeof key !== "string" || !key.trim()) return "unconfigured";
  const k = key.trim();
  if (/^(sk|rk)_live_/.test(k)) return "live";
  if (/^(sk|rk)_test_/.test(k)) return "test";
  return "unknown";
}

const stripeMode = detectStripeMode(STRIPE_SECRET_KEY);
if (configured) console.log(`[stripe] running in ${stripeMode.toUpperCase()} mode.`);

module.exports = { stripe, isStripeConfigured: configured, stripeMode, detectStripeMode };
