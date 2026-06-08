// Reset the first invoice back to unpaid + clear its payments, for re-testing.
// Run: node --env-file=.env.local scripts/reset-invoice.mjs
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: inv } = await db
  .from("invoices")
  .select("id")
  .order("created_at", { ascending: true })
  .limit(1)
  .maybeSingle();
if (!inv) { console.log("no invoice"); process.exit(2); }

await db.from("payments").delete().eq("invoice_id", inv.id);
await db.from("invoices").update({ status: "unpaid", paid_at: null }).eq("id", inv.id);
console.log(`Reset invoice ${inv.id} -> unpaid, payments cleared.`);
