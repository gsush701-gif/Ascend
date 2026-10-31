# Taking real payments (Stripe live mode)

Stripe test mode and live mode are two completely separate worlds: separate
keys, separate products and prices, separate webhooks, separate customers.
Switching is **configuration only** — no code change, no redeploy of old code.

Do this when real users actually want to pay, not before. Everything in test
mode keeps working until you flip the variables below.

## 0. Before you start

- [ ] Real users are asking for Pro (see the Admin funnel).
- [ ] The Pro price is a decision, not the $9 placeholder. Check cost per
      voice interview against it (ElevenLabs credits are the big cost).
- [ ] The privacy policy is live (`/privacy`). Add refund terms somewhere
      users can read them before paying.
- [ ] Your ElevenLabs plan allows commercial use (the free plan does not, as
      far as we know — read their terms).

## 1. Activate your Stripe account

In the Stripe dashboard, switch off "Test mode" and complete activation:
business details, bank account for payouts, identity verification. Stripe
will not give you a usable live key until this is done.

## 2. Create the live price

Run once, with the **live** secret key (sk_live_…) in your shell only:

    STRIPE_SECRET_KEY=sk_live_... node server/scripts/setup-stripe-plans.js

A live key never writes to `server/lib/plans.js`; the script prints the live
price id instead. It looks like `price_1…`.

## 3. Add the live webhook

Stripe → Developers → Webhooks (live mode) → Add endpoint:

- URL: `https://<your-backend>.onrender.com/api/billing/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted` (exactly the three the backend handles).

Copy the endpoint's **signing secret** (whsec_…).

## 4. Set the backend environment (Render → Ascend-1 → Environment)

| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | the live secret key (`sk_live_…`) |
| `STRIPE_PRO_PRICE_ID` | the live price id from step 2 |
| `STRIPE_WEBHOOK_SECRET` | the live webhook signing secret from step 3 |

Save; Render redeploys. In the service logs you should see
`[stripe] running in LIVE mode.`

The frontend needs no change. (`VITE_STRIPE_PUBLISHABLE_KEY` is unused today
because Checkout redirects through a backend-created session.)

## 5. Prove it with one real payment

1. Use a spare account. Upgrade to Pro and pay with a real card for the real
   price.
2. Confirm the plan flips to Pro in Plan & billing, and the voice interview
   unlocks.
3. Admin → Billing should show the subscription, with live data.
4. Delete that test account from the account menu (this cancels the
   subscription), then refund the payment in the Stripe dashboard.

## Rolling back

Put the test key, test price id and test webhook secret back in the same three
variables. Nothing else changes.
