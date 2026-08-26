/**
 * Stripe billing helpers (Phase 4b) — pure mapping/config functions plus the
 * DB-writing orchestration called from POST /api/billing/webhook in
 * server/index.js. Split out into its own module (mirroring usage.js and
 * scoring.js) so the pure parts are directly unit-testable without a live
 * Stripe or Supabase connection — see billing.test.js.
 */

/**
 * Resolves the frontend origin to send Checkout/Portal sessions back to.
 * Reuses whatever's already configured for CORS (server/index.js's
 * CORS_ORIGIN) rather than inventing a second env var that would need to be
 * kept in sync with it — falls back to an explicit FRONTEND_URL if that's
 * ever set separately, then the first entry of CORS_ORIGIN (skipping the
 * "*" wildcard, which isn't a usable redirect target), then localhost for
 * local dev when neither is set.
 */
function getFrontendUrl(env = process.env) {
  if (env.FRONTEND_URL) return env.FRONTEND_URL.replace(/\/+$/, "");
  const corsOrigin = env.CORS_ORIGIN;
  if (corsOrigin && corsOrigin !== "*") {
    const first = corsOrigin.split(",")[0].trim();
    if (first) return first.replace(/\/+$/, "");
  }
  return "http://localhost:5173";
}

function toIsoOrNull(unixSeconds) {
  return typeof unixSeconds === "number" ? new Date(unixSeconds * 1000).toISOString() : null;
}

/** Row shape for a fresh `checkout.session.completed` — a brand-new (or re-)subscription to Pro. */
function buildCheckoutCompletedRow({ userId, customerId, subscriptionId, currentPeriodEndUnix }) {
  return {
    user_id: userId,
    plan: "pro",
    status: "active",
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    current_period_end: toIsoOrNull(currentPeriodEndUnix),
    updated_at: new Date().toISOString(),
  };
}

/** Row shape for `customer.subscription.updated` — renewals and Stripe's own dunning-state transitions. */
function buildSubscriptionUpdateRow(subscription) {
  return {
    status: subscription.status,
    stripe_subscription_id: subscription.id,
    current_period_end: toIsoOrNull(subscription.current_period_end),
    updated_at: new Date().toISOString(),
  };
}

/** Row shape for `customer.subscription.deleted` — full cancellation, downgrade back to free. */
function buildSubscriptionDowngradeRow() {
  return {
    plan: "free",
    status: "canceled",
    updated_at: new Date().toISOString(),
  };
}

/**
 * checkout.session.completed: a user just finished Stripe Checkout for Pro.
 * Upserts on `user_id` (the table's unique column,
 * supabase/migrations/012_subscriptions.sql) so this is safe to run more
 * than once for the same event — Stripe redelivers webhooks on anything
 * that doesn't cleanly 2xx, and this must not create a duplicate/conflicting
 * row on a retry.
 */
async function handleCheckoutSessionCompleted(session, { stripe, supabaseAdmin }) {
  const userId = session.client_reference_id || session.metadata?.supabase_user_id;
  if (!userId) {
    console.warn(
      "[billing webhook] checkout.session.completed had no client_reference_id/metadata user id — skipping",
    );
    return;
  }
  if (!supabaseAdmin) {
    console.warn("[billing webhook] supabaseAdmin not configured — cannot persist subscription");
    return;
  }

  const subscriptionId = session.subscription;
  let currentPeriodEndUnix;
  if (subscriptionId && stripe) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    currentPeriodEndUnix = subscription.current_period_end;
  }

  const row = buildCheckoutCompletedRow({
    userId,
    customerId: session.customer,
    subscriptionId,
    currentPeriodEndUnix,
  });

  const { error } = await supabaseAdmin.from("subscriptions").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);
}

/**
 * customer.subscription.updated fires on renewals, plan/quantity changes,
 * and Stripe's own dunning transitions (active -> past_due, etc). This event
 * doesn't carry our Supabase user id directly, so the local row is looked up
 * by stripe_customer_id instead (set on the row by the checkout handler
 * above).
 */
async function handleSubscriptionUpdated(subscription, { supabaseAdmin }) {
  if (!supabaseAdmin) {
    console.warn("[billing webhook] supabaseAdmin not configured — cannot sync subscription");
    return;
  }
  const customerId = subscription.customer;
  const { data, error: lookupError } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (lookupError || !data) {
    console.warn(
      `[billing webhook] subscription.updated: no local subscriptions row for customer ${customerId} — skipping`,
    );
    return;
  }
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update(buildSubscriptionUpdateRow(subscription))
    .eq("user_id", data.user_id);
  if (error) throw new Error(`subscriptions update failed: ${error.message}`);
}

/**
 * customer.subscription.deleted: the subscription is fully canceled (not
 * merely past_due) — downgrade the user back to free.
 */
async function handleSubscriptionDeleted(subscription, { supabaseAdmin }) {
  if (!supabaseAdmin) {
    console.warn("[billing webhook] supabaseAdmin not configured — cannot downgrade subscription");
    return;
  }
  const customerId = subscription.customer;
  const { data, error: lookupError } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (lookupError || !data) {
    console.warn(
      `[billing webhook] subscription.deleted: no local subscriptions row for customer ${customerId} — skipping`,
    );
    return;
  }
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update(buildSubscriptionDowngradeRow())
    .eq("user_id", data.user_id);
  if (error) throw new Error(`subscriptions downgrade failed: ${error.message}`);
}

module.exports = {
  getFrontendUrl,
  buildCheckoutCompletedRow,
  buildSubscriptionUpdateRow,
  buildSubscriptionDowngradeRow,
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
};
