// Poll prod after a redeploy: reset invoice → signed webhook → check payment row.
// Run: node --env-file=.env.local scripts/stripe-verify-loop.mjs <whsec>
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const PROD = "https://hong-badminton-academy.vercel.app/api/webhooks/stripe";
const whsec = process.argv[2] || process.env.STRIPE_WEBHOOK_SECRET;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function invoiceId() {
  const { data } = await db.from("invoices").select("id, amount, currency").order("created_at").limit(1).maybeSingle();
  return data;
}

for (let i = 1; i <= 12; i++) {
  const inv = await invoiceId();
  if (!inv) { console.log("no invoice"); process.exit(2); }
  // reset
  await db.from("payments").delete().eq("invoice_id", inv.id);
  await db.from("invoices").update({ status: "unpaid", paid_at: null }).eq("id", inv.id);

  // signed event
  const event = {
    id: "evt_test_" + Math.random().toString(36).slice(2),
    object: "event",
    type: "checkout.session.completed",
    data: { object: {
      id: "cs_test_" + Math.random().toString(36).slice(2),
      object: "checkout.session",
      client_reference_id: inv.id,
      metadata: { invoice_id: inv.id },
      amount_total: Math.round(Number(inv.amount) * 100),
      currency: String(inv.currency).toLowerCase(),
      payment_intent: "pi_test_" + Math.random().toString(36).slice(2),
    } },
  };
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: whsec });
  const res = await fetch(PROD, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: payload });

  const { data: pay } = await db.from("payments").select("amount, currency, provider, status, provider_txn_id").eq("invoice_id", inv.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: after } = await db.from("invoices").select("status").eq("id", inv.id).maybeSingle();
  console.log(`#${i}  HTTP ${res.status}  invoice=${after?.status}  payment=${pay ? "YES" : "null"}`);

  if (res.status === 200 && pay) {
    console.log("\n✅ Reconciliation works:");
    console.log("   invoice ->", after?.status);
    console.log("   payment ->", JSON.stringify(pay));
    process.exit(0);
  }
  await sleep(15000);
}
console.log("\n⏳ New deploy not live within timeout — payment row still missing.");
process.exit(1);
