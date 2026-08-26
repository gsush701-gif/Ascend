#!/usr/bin/env node
/**
 * One-time (but safely re-runnable) setup script: ensures a Stripe Product +
 * recurring monthly Price exist for Ascend's "Pro" plan, matching
 * server/lib/plans.js's `pro.priceMonthly`, then writes the resulting Price
 * id back into that exact file's `pro.stripePriceId` field — keeping
 * plans.js the single source of truth for both the price definition and
 * which live Stripe object represents it (Phase 4a's design, extended here
 * rather than introducing a second config file).
 *
 * Idempotent: run it as many times as you like.
 *   - If a Product tagged `metadata.ascend_plan = "pro"` already exists, it's
 *     reused rather than duplicated.
 *   - If that Product already has an active recurring monthly Price at the
 *     current `priceMonthly` amount, that Price is reused.
 *   - Otherwise the missing piece(s) are created.
 *
 * If you change `priceMonthly` in plans.js, re-run this script: Stripe
 * Prices are immutable, so it will create a new Price object under the same
 * Product and update `stripePriceId` to point at it. The old Price is left
 * alone (Stripe doesn't allow deleting Prices that have ever been used) —
 * that's expected and harmless.
 *
 * Usage:  node server/scripts/setup-stripe-plans.js
 * Requires STRIPE_SECRET_KEY in server/.env (test-mode key is fine — this
 * only touches the Products/Prices catalog, no real charges are involved).
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY is not set (check server/.env) — aborting.");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Required at call time (not at module load) so this script's own failure
// mode ("plans.js has no stripePriceId field yet") is a clear error instead
// of a confusing crash at require() if someone reorders things later.
const PLANS_FILE = path.join(__dirname, "..", "lib", "plans.js");

async function findExistingProProduct() {
  // list()+filter rather than products.search(): Stripe's Search API has a
  // documented indexing delay (not immediately consistent after a create),
  // which would make this script's own idempotency check unreliable right
  // after it creates a product. A plain list is immediately consistent and
  // the Products catalog is small, so this is cheap either way.
  const products = await stripe.products.list({ active: true, limit: 100 });
  return products.data.find((p) => p.metadata && p.metadata.ascend_plan === "pro") || null;
}

async function findMatchingMonthlyPrice(productId, unitAmount) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  return (
    prices.data.find(
      (p) =>
        p.recurring &&
        p.recurring.interval === "month" &&
        p.unit_amount === unitAmount &&
        p.currency === "usd",
    ) || null
  );
}

function writePriceIdIntoPlansFile(priceId) {
  const original = fs.readFileSync(PLANS_FILE, "utf8");
  // Deliberately narrow/targeted: only ever touches the `stripePriceId`
  // field inside the `pro: { ... }` block, and refuses to write anything if
  // that exact shape isn't found — a botched regex silently corrupting
  // plans.js (the single source of truth for pricing/quotas) would be a much
  // worse failure than this script just erroring out.
  const pattern = /(pro:\s*\{[\s\S]*?stripePriceId:\s*)(null|"[^"]*")/;
  if (!pattern.test(original)) {
    throw new Error(
      "Could not find a `stripePriceId` field inside the `pro` plan block in " +
        PLANS_FILE +
        " — refusing to write. Check the file hasn't been restructured.",
    );
  }
  const updated = original.replace(pattern, `$1"${priceId}"`);
  fs.writeFileSync(PLANS_FILE, updated, "utf8");
}

async function main() {
  // Re-require after dotenv has loaded so this always reflects the current
  // file on disk, including a stripePriceId from a previous run.
  delete require.cache[require.resolve("../lib/plans")];
  const { PLANS } = require("../lib/plans");

  const unitAmount = PLANS.pro.priceMonthly;
  console.log(
    `Ensuring a Stripe Product + monthly Price exist for Ascend Pro ($${(unitAmount / 100).toFixed(2)}/mo, USD)...`,
  );

  let product = await findExistingProProduct();
  if (product) {
    console.log(`Found existing product: ${product.id} ("${product.name}")`);
  } else {
    product = await stripe.products.create({
      name: "Ascend Pro",
      description: "Ascend Pro subscription — higher monthly AI usage limits.",
      metadata: { ascend_plan: "pro" },
    });
    console.log(`Created product: ${product.id}`);
  }

  let price = await findMatchingMonthlyPrice(product.id, unitAmount);
  if (price) {
    console.log(`Found existing matching monthly price: ${price.id} ($${(price.unit_amount / 100).toFixed(2)}/mo)`);
  } else {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { ascend_plan: "pro" },
    });
    console.log(`Created new price: ${price.id} ($${(price.unit_amount / 100).toFixed(2)}/mo)`);
  }

  if (PLANS.pro.stripePriceId === price.id) {
    console.log("plans.js already has this exact stripePriceId — nothing to write.");
  } else {
    writePriceIdIntoPlansFile(price.id);
    console.log(`Wrote stripePriceId = "${price.id}" into server/lib/plans.js (pro plan).`);
  }

  console.log("Done. This script is safe to re-run any time.");
}

main().catch((err) => {
  console.error("setup-stripe-plans failed:", err);
  process.exit(1);
});
