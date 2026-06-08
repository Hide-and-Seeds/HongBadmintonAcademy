// Fire a properly-SIGNED checkout.session.completed at the PROD webhook for a
// real unpaid invoice, then check it flipped to paid.
// Run: node --env-file=.env.local scripts/stripe-webhook-test.mjs <whsec>
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const PROD = "https://hong-badminton-academy.vercel.app/api/webhooks/stripe";
const whsec = process.argv[2] || process.env.STRIPE_WEBHOOK_SECRET;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// Pick an unpaid invoice (fallback: any invoice).
let { data: inv } = await db
  .from("invoices")
  .select("id, amount, currency, status")
  .in("status", ["unpaid", "overdue"])
  .limit(1)
  .maybeSingle();
if (!inv) {
  ({ data: inv } = await db.from("invoices").select("id, amount, currency, status").limit(1).maybeSingle());
}
if (!inv) { console.log("No invoice to test with."); process.exit(2); }
console.log(`Invoice ${inv.id} status BEFORE = ${inv.status}`);

const event = {
  id: "evt_test_" + Math.random().toString(36).slice(2),
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_" + Math.random().toString(36).slice(2),
      object: "checkout.session",
      client_reference_id: inv.id,
      metadata: { invoice_id: inv.id },
      amount_total: Math.round(Number(inv.amount) * 100),
      currency: String(inv.currency).toLowerCase(),
      payment_intent: "pi_test_" + Math.random().toString(36).slice(2),
    },
  },
};
const payload = JSON.stringify(event);
const header = stripe.webhooks.generateTestHeaderString({ payload, secret: whsec });

const res = await fetch(PROD, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": header },
  body: payload,
});
console.log(`POST ${PROD}`);
console.log(`  whsec=${whsec.slice(0, 12)}…  ->  HTTP ${res.status}  ${await res.text()}`);

if (res.status === 200) {
  const { data: after } = await db
    .from("invoices")
    .select("status, paid_at")
    .eq("id", inv.id)
    .maybeSingle();
  const { data: pay } = await db
    .from("payments")
    .select("amount, currency, provider, status, provider_txn_id")
    .eq("invoice_id", inv.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log(`Invoice status AFTER = ${after?.status}, paid_at=${after?.paid_at}`);
  console.log(`Payment row:`, pay);
}
