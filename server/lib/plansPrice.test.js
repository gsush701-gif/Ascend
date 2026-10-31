import { describe, expect, it } from "vitest";
import { getProPriceId, PLANS } from "./plans.js";
import { detectStripeMode } from "./stripe.js";

describe("getProPriceId — test/live switching is configuration only", () => {
  it("prefers STRIPE_PRO_PRICE_ID over the id baked into plans.js", () => {
    expect(getProPriceId({ STRIPE_PRO_PRICE_ID: "price_live_123" })).toBe("price_live_123");
  });

  it("trims whitespace, and falls back to plans.js when unset or blank", () => {
    expect(getProPriceId({ STRIPE_PRO_PRICE_ID: "  price_x  " })).toBe("price_x");
    expect(getProPriceId({})).toBe(PLANS.pro.stripePriceId);
    expect(getProPriceId({ STRIPE_PRO_PRICE_ID: "   " })).toBe(PLANS.pro.stripePriceId);
  });
});

describe("detectStripeMode — only ever reads the key's prefix", () => {
  it("recognises live and test keys, restricted keys included", () => {
    expect(detectStripeMode("sk_live_abc")).toBe("live");
    expect(detectStripeMode("rk_live_abc")).toBe("live");
    expect(detectStripeMode("sk_test_abc")).toBe("test");
    expect(detectStripeMode("rk_test_abc")).toBe("test");
  });

  it("reports unconfigured for empty values and unknown for anything else", () => {
    expect(detectStripeMode(undefined)).toBe("unconfigured");
    expect(detectStripeMode("  ")).toBe("unconfigured");
    expect(detectStripeMode("not-a-key")).toBe("unknown");
  });
});
