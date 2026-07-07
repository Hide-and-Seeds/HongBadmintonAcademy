"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { clubJoinSchema } from "@/lib/validation";
import { getPaymentProvider } from "@/lib/payments";
import { isStripeConfigured } from "@/lib/env";
import { getBaseUrl } from "@/lib/url";

function err(message: string): never {
  redirect(`/club?error=${encodeURIComponent(message)}`);
}

// Public "Join the club" → create a pending member + a club invoice, then send
// them to Stripe Checkout. The Stripe webhook flips the invoice to paid and
// activates the member (see api/webhooks/stripe). No login needed to join;
// member portal + renewals come in 2b-2.
export async function joinClub(formData: FormData) {
  if (!isStripeConfigured()) err("Online payment isn't set up yet — please contact the club.");

  const parsed = clubJoinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) err(parsed.error.issues[0].message);
  const { full_name, email, phone, tier_id } = parsed.data;

  const db = createAdminClient();

  // Re-validate the tier server-side: it must be an ACTIVE CLUB fee plan. Never
  // trust the posted amount — we read it from the plan.
  const { data: tier } = await db
    .from("fee_plans")
    .select("id, name, amount, currency, business, is_active")
    .eq("id", tier_id)
    .maybeSingle();
  if (!tier || (tier as any).business !== "club" || !(tier as any).is_active) {
    err("That membership option isn't available. Please pick another.");
  }

  const { data: member, error: mErr } = await db
    .from("club_members")
    .insert({ full_name, email, phone, tier_id, status: "pending" })
    .select("id")
    .single();
  if (mErr || !member) err("Couldn't start your signup. Please try again.");

  const now = new Date();
  const period = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-CA");
  const dueDate = new Date(now.getFullYear(), now.getMonth(), 7).toLocaleDateString("en-CA");

  const { data: inv, error: iErr } = await db
    .from("invoices")
    .insert({
      club_member_id: member.id,
      fee_plan_id: (tier as any).id,
      amount: (tier as any).amount,
      currency: (tier as any).currency,
      business: "club",
      period_month: period,
      due_date: dueDate,
      description: `Club membership — ${(tier as any).name}`,
      status: "unpaid",
    })
    .select("id")
    .single();
  if (iErr || !inv) err("Couldn't create your invoice. Please try again.");

  const baseUrl = await getBaseUrl();
  const checkout = await getPaymentProvider().createCheckoutSession({
    invoiceId: inv.id,
    amount: Number((tier as any).amount),
    currency: (tier as any).currency,
    description: `Club membership — ${(tier as any).name}`,
    business: "club",
    customerEmail: email,
    successUrl: `${baseUrl}/club/thanks`,
    cancelUrl: `${baseUrl}/club`,
  });

  await db.from("invoices").update({ stripe_checkout_session_id: checkout.reference }).eq("id", inv.id);
  redirect(checkout.url);
}
