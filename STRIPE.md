# Stripe Integration

Online fee payments for Hong Badminton Academy — Stripe Checkout (hosted page) +
signature-verified webhooks that reconcile invoices automatically.

## Status

- **Code:** complete — checkout, webhooks, reconciliation, per-parent customer
  reuse, and fee-plan → Stripe catalog sync.
- **Local env:** already configured with **sandbox test keys**. Verified — a test
  checkout session was created successfully via `scripts/stripe-smoke.mjs`.
- **Connected account:** `acct_1TesJv…` ("Hide and Seeds sandbox", test mode).
- **Seeded:** fee plan _Monthly — Junior_ mirrored to Stripe
  `prod_UfUQR2C6yKyD8h` / `price_1Tg9RlEMReabYyUwY8vLTOp4` (RM150/mo recurring).

## How a payment flows

1. Admin raises an invoice (**Admin → Invoices → New invoice**).
2. Parent opens **Fees & Payments** (or a child's **Package & Fees**) → **Pay now**.
3. `payInvoice` creates a Stripe Checkout session (one-time, MYR), attaches/creates
   a Stripe Customer for that parent, and redirects to Stripe's hosted page.
4. Parent pays. Stripe redirects back to `/parent/invoices?paid=1`.
5. Stripe POSTs a webhook to `/api/webhooks/stripe`. We verify the signature, mark
   the invoice **paid**, and insert a row in `payments` (idempotent on event id).

**Webhook events handled**

| Event | Effect |
|-------|--------|
| `checkout.session.completed`, `checkout.session.async_payment_succeeded` | invoice → `paid`, payment `succeeded` |
| `checkout.session.async_payment_failed` | invoice → `unpaid`, payment `failed` |
| `charge.refunded` | invoice → `refunded`, payment `refunded` |

## Environment variables

Set locally (`.env.local`) **and** in Vercel (Project → Settings → Environment Variables):

| Var | Scope | Notes |
|-----|-------|-------|
| `STRIPE_SECRET_KEY` | server | `sk_test_…` (sandbox) or `sk_live_…` (production). |
| `STRIPE_WEBHOOK_SECRET` | server | `whsec_…` signing secret of your webhook endpoint. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client | `pk_…` — optional for redirect checkout; set it for future client-side Stripe.js. |
| `PAYMENT_CURRENCY` | server | default `MYR`. |

Local is already filled with sandbox keys. **For production, add the same (or live)
keys in Vercel and redeploy** — Vercel does not read `.env.local`.

## Webhook setup

**Local (Stripe CLI):**
```bash
stripe login
stripe listen --forward-to localhost:3030/api/webhooks/stripe
# copy the printed whsec_… into STRIPE_WEBHOOK_SECRET, then restart `next dev`
```

**Production (Stripe Dashboard → Developers → Webhooks → Add endpoint):**
- URL: `https://<your-domain>/api/webhooks/stripe`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `charge.refunded`
- Copy the endpoint's **Signing secret** → `STRIPE_WEBHOOK_SECRET` in Vercel → redeploy.

## Fee plan ↔ Stripe catalog

**Admin → Fee Plans** shows a Stripe status banner (mode + webhook) and a
**Sync to Stripe** button. Sync mirrors each active fee plan to a Stripe Product +
Price (monthly plans get a recurring price, ready for subscriptions later) and stores
the ids on the plan. Stored ids self-heal — if you switch Stripe accounts, re-sync
just creates fresh ones.

## Testing (test mode)

- Test card: `4242 4242 4242 4242`, any future expiry, any CVC, any postcode.
- More scenarios: https://stripe.com/docs/testing
- Verify the key any time: `node --env-file=.env.local scripts/stripe-smoke.mjs`
- Fire a webhook locally: `stripe trigger checkout.session.completed`

## Go-live checklist

- [ ] Put **live** keys (`sk_live_`, `pk_live_`) in Vercel.
- [ ] Create a **live** webhook endpoint → set the live `STRIPE_WEBHOOK_SECRET` in Vercel.
- [ ] Enable MYR + the payment methods you want (Cards, FPX, GrabPay…) under
      Stripe → Settings → Payment methods.
- [ ] Re-run **Sync to Stripe** on the live account.
- [ ] Do one small real end-to-end transaction.

## Files

- `src/lib/payments/{index,stripe,types}.ts` — provider + helpers (checkout, customer
  reuse, fee-plan sync, `stripeMode()`).
- `src/app/(parent)/parent/invoices/actions.ts` — `payInvoice` (creates checkout).
- `src/app/api/webhooks/stripe/route.ts` — signature-verified webhook + reconciliation.
- `src/app/(admin)/admin/fee-plans/{page.tsx,actions.ts}` — status banner + Sync.
- `supabase/migrations/0005_stripe.sql` — `stripe_customer_id` / `stripe_product_id` /
  `stripe_price_id`.
- `scripts/stripe-smoke.mjs` — key/checkout smoke test.
