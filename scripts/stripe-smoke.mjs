// Stripe smoke test — verifies the secret key + checkout params work.
// node --env-file=.env.local scripts/stripe-smoke.mjs
import Stripe from "stripe";

const s = new Stripe(process.env.STRIPE_SECRET_KEY);

const acct = await s.accounts.retrieve();
const sess = await s.checkout.sessions.create({
  mode: "payment",
  client_reference_id: "smoke",
  line_items: [
    {
      quantity: 1,
      price_data: {
        currency: "myr",
        unit_amount: 15000,
        product_data: { name: "Smoke test — HBA" },
      },
    },
  ],
  metadata: { invoice_id: "smoke" },
  success_url: "https://example.com/success",
  cancel_url: "https://example.com/cancel",
});

console.log("account     :", acct.id);
console.log("mode        :", sess.livemode ? "LIVE" : "test");
console.log("session id  :", sess.id);
console.log("has checkout:", sess.url ? "yes" : "no");
console.log("amount_total:", sess.amount_total, sess.currency);
