import { describe, it, expect, vi } from "vitest";
import {
  getFrontendUrl,
  buildCheckoutCompletedRow,
  buildSubscriptionUpdateRow,
  buildSubscriptionDowngradeRow,
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from "./billing.js";

/**
 * Minimal fake of the Supabase query-builder chain used by billing.js's
 * three webhook handlers (`.from(table).upsert(...)`,
 * `.from(table).select(...).eq(...).maybeSingle()`,
 * `.from(table).update(...).eq(...)`), recording every call so tests can
 * assert on exactly what would have been sent to Postgres — without ever
 * touching a real Supabase project. This is deliberate: the real
 * `subscriptions` table isn't applied to the production database yet (see
 * supabase/migrations/012_subscriptions.sql's header), and this repo's own
 * convention is that feature agents never use the service-role client
 * against real/production data for their own testing.
 */
function createFakeSupabaseAdmin({
  maybeSingleResult = { data: null, error: null },
  updateResult = { error: null },
} = {}) {
  const calls = { upsert: [], update: [], select: [], eq: [] };

  // The real supabase-js query builder is itself "thenable" at every step
  // (awaiting it directly triggers the request), which is why
  // `.update(x).eq(y, z)` can be awaited on its own with no terminal method,
  // while `.select(x).eq(y, z).maybeSingle()` calls one more method first.
  // This fake's `eq()` return value supports both shapes: `.maybeSingle()`
  // for the lookup path, and being awaited directly (via `.then`) for the
  // update path.
  function eqResult() {
    return {
      maybeSingle: vi.fn(() => Promise.resolve(maybeSingleResult)),
      then: (resolve, reject) => Promise.resolve(updateResult).then(resolve, reject),
    };
  }

  const builder = {
    upsert: vi.fn((row, opts) => {
      calls.upsert.push({ row, opts });
      return Promise.resolve({ error: null });
    }),
    select: vi.fn((cols) => {
      calls.select.push(cols);
      return builder;
    }),
    update: vi.fn((row) => {
      calls.update.push(row);
      return builder;
    }),
    eq: vi.fn((col, val) => {
      calls.eq.push({ col, val });
      return eqResult();
    }),
  };
  const supabaseAdmin = { from: vi.fn(() => builder), _calls: calls };
  return supabaseAdmin;
}

describe("getFrontendUrl — resolving the redirect target for Checkout/Portal", () => {
  it("prefers an explicit FRONTEND_URL when set", () => {
    expect(getFrontendUrl({ FRONTEND_URL: "https://ascend.app/", CORS_ORIGIN: "https://other.com" })).toBe(
      "https://ascend.app",
    );
  });

  it("falls back to the first entry of CORS_ORIGIN when FRONTEND_URL is unset", () => {
    expect(getFrontendUrl({ CORS_ORIGIN: "https://ascend.app,https://staging.ascend.app" })).toBe(
      "https://ascend.app",
    );
  });

  it("trims whitespace and a trailing slash from the resolved origin", () => {
    expect(getFrontendUrl({ CORS_ORIGIN: " https://ascend.app/ " })).toBe("https://ascend.app");
  });

  it("ignores a wildcard CORS_ORIGIN (not a usable redirect target)", () => {
    expect(getFrontendUrl({ CORS_ORIGIN: "*" })).toBe("http://localhost:5173");
  });

  it("falls back to localhost when nothing is configured", () => {
    expect(getFrontendUrl({})).toBe("http://localhost:5173");
  });
});

describe("buildCheckoutCompletedRow — checkout.session.completed upsert shape", () => {
  it("maps a completed checkout session into an active Pro subscription row", () => {
    const row = buildCheckoutCompletedRow({
      userId: "user-123",
      customerId: "cus_abc",
      subscriptionId: "sub_abc",
      currentPeriodEndUnix: 1893456000, // 2030-01-01T00:00:00.000Z
    });
    expect(row.user_id).toBe("user-123");
    expect(row.plan).toBe("pro");
    expect(row.status).toBe("active");
    expect(row.stripe_customer_id).toBe("cus_abc");
    expect(row.stripe_subscription_id).toBe("sub_abc");
    expect(row.current_period_end).toBe("2030-01-01T00:00:00.000Z");
    expect(typeof row.updated_at).toBe("string");
  });

  it("stores null current_period_end when no unix timestamp is available", () => {
    const row = buildCheckoutCompletedRow({
      userId: "user-123",
      customerId: "cus_abc",
      subscriptionId: undefined,
      currentPeriodEndUnix: undefined,
    });
    expect(row.current_period_end).toBeNull();
    expect(row.stripe_subscription_id).toBeUndefined();
  });
});

describe("buildSubscriptionUpdateRow — customer.subscription.updated sync shape", () => {
  it("carries through Stripe's own status string (e.g. past_due, active)", () => {
    const row = buildSubscriptionUpdateRow({
      id: "sub_abc",
      status: "past_due",
      current_period_end: 1893456000,
    });
    expect(row.status).toBe("past_due");
    expect(row.stripe_subscription_id).toBe("sub_abc");
    expect(row.current_period_end).toBe("2030-01-01T00:00:00.000Z");
  });

  it("stores null current_period_end when the subscription object omits it", () => {
    const row = buildSubscriptionUpdateRow({ id: "sub_abc", status: "active" });
    expect(row.current_period_end).toBeNull();
  });
});

describe("buildSubscriptionDowngradeRow — customer.subscription.deleted downgrade shape", () => {
  it("always downgrades to free/canceled regardless of input", () => {
    const row = buildSubscriptionDowngradeRow();
    expect(row.plan).toBe("free");
    expect(row.status).toBe("canceled");
    expect(typeof row.updated_at).toBe("string");
  });
});

// --- Orchestration-level tests: run the real webhook handlers end-to-end
// against a fake Supabase client (see createFakeSupabaseAdmin above), so the
// actual upsert/update calls a real webhook delivery would trigger are
// verified directly, without ever touching a real Supabase project — the
// real `subscriptions` table isn't live in production yet (Phase 4a), and
// this repo's convention is that agents don't use the service-role client
// against real data for their own testing.
describe("handleCheckoutSessionCompleted — writes an active Pro row keyed by the checkout session's user", () => {
  it("upserts the correct row onto subscriptions, keyed by user_id", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin();
    const stripe = {
      subscriptions: {
        retrieve: vi.fn(() => Promise.resolve({ id: "sub_test123", current_period_end: 1893456000 })),
      },
    };
    const session = {
      client_reference_id: "user-abc",
      customer: "cus_test123",
      subscription: "sub_test123",
      metadata: { supabase_user_id: "user-abc" },
    };

    await handleCheckoutSessionCompleted(session, { stripe, supabaseAdmin });

    expect(supabaseAdmin.from).toHaveBeenCalledWith("subscriptions");
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_test123");
    expect(supabaseAdmin._calls.upsert).toHaveLength(1);
    const { row, opts } = supabaseAdmin._calls.upsert[0];
    expect(opts).toEqual({ onConflict: "user_id" });
    expect(row).toMatchObject({
      user_id: "user-abc",
      plan: "pro",
      status: "active",
      stripe_customer_id: "cus_test123",
      stripe_subscription_id: "sub_test123",
      current_period_end: "2030-01-01T00:00:00.000Z",
    });
  });

  it("falls back to metadata.supabase_user_id when client_reference_id is absent", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin();
    const stripe = { subscriptions: { retrieve: vi.fn(() => Promise.resolve({ current_period_end: null })) } };
    const session = { customer: "cus_x", subscription: "sub_x", metadata: { supabase_user_id: "user-meta" } };

    await handleCheckoutSessionCompleted(session, { stripe, supabaseAdmin });

    expect(supabaseAdmin._calls.upsert[0].row.user_id).toBe("user-meta");
  });

  it("skips the write (does not throw) when no user id can be found on the session", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin();
    await handleCheckoutSessionCompleted({ customer: "cus_x" }, { stripe: null, supabaseAdmin });
    expect(supabaseAdmin._calls.upsert).toHaveLength(0);
  });
});

describe("handleSubscriptionUpdated — syncs status/current_period_end by stripe_customer_id lookup", () => {
  it("updates the row belonging to the matched customer", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin({
      maybeSingleResult: { data: { user_id: "user-abc" }, error: null },
    });
    const subscription = { id: "sub_test123", customer: "cus_test123", status: "past_due", current_period_end: 1893456000 };

    await handleSubscriptionUpdated(subscription, { supabaseAdmin });

    expect(supabaseAdmin._calls.eq[0]).toEqual({ col: "stripe_customer_id", val: "cus_test123" });
    expect(supabaseAdmin._calls.update).toHaveLength(1);
    expect(supabaseAdmin._calls.update[0]).toMatchObject({
      status: "past_due",
      stripe_subscription_id: "sub_test123",
      current_period_end: "2030-01-01T00:00:00.000Z",
    });
    // The final .eq("user_id", ...) call scopes the update to the right row.
    expect(supabaseAdmin._calls.eq[1]).toEqual({ col: "user_id", val: "user-abc" });
  });

  it("skips the write when no local row matches the customer id (logs, does not throw)", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin({ maybeSingleResult: { data: null, error: null } });
    await handleSubscriptionUpdated({ id: "sub_x", customer: "cus_unknown", status: "active" }, { supabaseAdmin });
    expect(supabaseAdmin._calls.update).toHaveLength(0);
  });
});

describe("handleSubscriptionDeleted — downgrades the matched user to free/canceled", () => {
  it("updates the row belonging to the matched customer to plan=free, status=canceled", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin({
      maybeSingleResult: { data: { user_id: "user-abc" }, error: null },
    });
    await handleSubscriptionDeleted({ id: "sub_test123", customer: "cus_test123" }, { supabaseAdmin });

    expect(supabaseAdmin._calls.eq[0]).toEqual({ col: "stripe_customer_id", val: "cus_test123" });
    expect(supabaseAdmin._calls.update).toHaveLength(1);
    expect(supabaseAdmin._calls.update[0]).toMatchObject({ plan: "free", status: "canceled" });
    expect(supabaseAdmin._calls.eq[1]).toEqual({ col: "user_id", val: "user-abc" });
  });

  it("skips the write when no local row matches the customer id (logs, does not throw)", async () => {
    const supabaseAdmin = createFakeSupabaseAdmin({ maybeSingleResult: { data: null, error: null } });
    await handleSubscriptionDeleted({ id: "sub_x", customer: "cus_unknown" }, { supabaseAdmin });
    expect(supabaseAdmin._calls.update).toHaveLength(0);
  });
});
