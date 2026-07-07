"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyClubToken } from "@/lib/club-auth";
import { getPaymentProvider } from "@/lib/payments";
import { isStripeConfigured } from "@/lib/env";
import { getBaseUrl } from "@/lib/url";

function backErr(token: string, message: string): never {
  redirect(`/club/me/${token}?error=${encodeURIComponent(message)}`);
}

// Pay a specific outstanding invoice that belongs to this member. The member is
// resolved from the signed token; the invoice is re-checked to belong to them,
// and the amount is read from the invoice — the client only posts ids.
export async function payMemberInvoice(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const invoiceId = String(formData.get("invoice_id") ?? "");
  const memberId = verifyClubToken(token);
  if (!memberId) redirect("/club");
  if (!isStripeConfigured()) backErr(token, "Online payment isn't set up yet — please contact the club.");

  const db = createAdminClient();
  const { data: inv } = await db
    .from("invoices")
    .select("id, amount, currency, description, status, club_member_id")
    .eq("id", invoiceId)
    .eq("club_member_id", memberId)
    .maybeSingle();
  if (!inv) backErr(token, "Invoice not found.");
  if (inv.status === "paid") backErr(token, "That invoice is already paid.");

  const baseUrl = await getBaseUrl();
  const checkout = await getPaymentProvider().createCheckoutSession({
    invoiceId: inv.id,
    amount: Number(inv.amount),
    currency: inv.currency,
    description: inv.description || "Club membership",
    business: "club",
    successUrl: `${baseUrl}/club/me/${token}?paid=1`,
    cancelUrl: `${baseUrl}/club/me/${token}`,
  });
  await db.from("invoices").update({ stripe_checkout_session_id: checkout.reference }).eq("id", inv.id);
  redirect(checkout.url);
}

// Renew: reuse the member's newest unpaid club invoice if one exists, else raise
// a fresh one for their tier, then send them to checkout.
export async function renewMembership(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const memberId = verifyClubToken(token);
  if (!memberId) redirect("/club");
  if (!isStripeConfigured()) backErr(token, "Online payment isn't set up yet — please contact the club.");

  const db = createAdminClient();
  const { data: member } = await db
    .from("club_members")
    .select("id, tier:fee_plans!club_members_tier_id_fkey(id, name, amount, currency, business, is_active)")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) redirect("/club");
  const tier = (member as any).tier;
  if (!tier || tier.business !== "club" || !tier.is_active) backErr(token, "No active membership tier — please contact the club.");

  const { data: existing } = await db
    .from("invoices")
    .select("id")
    .eq("club_member_id", memberId)
    .in("status", ["unpaid", "overdue"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let invoiceId = existing?.id ?? null;
  if (!invoiceId) {
    const now = new Date();
    const period = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-CA");
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 7).toLocaleDateString("en-CA");
    const { data: inv, error } = await db
      .from("invoices")
      .insert({
        club_member_id: memberId,
        fee_plan_id: tier.id,
        amount: tier.amount,
        currency: tier.currency,
        business: "club",
        period_month: period,
        due_date: dueDate,
        description: `Club membership — ${tier.name}`,
        status: "unpaid",
      })
      .select("id")
      .single();
    if (error || !inv) backErr(token, "Couldn't start your renewal. Please try again.");
    invoiceId = inv.id;
  }

  const baseUrl = await getBaseUrl();
  const checkout = await getPaymentProvider().createCheckoutSession({
    invoiceId: invoiceId!,
    amount: Number(tier.amount),
    currency: tier.currency,
    description: `Club membership — ${tier.name}`,
    business: "club",
    successUrl: `${baseUrl}/club/me/${token}?paid=1`,
    cancelUrl: `${baseUrl}/club/me/${token}`,
  });
  await db.from("invoices").update({ stripe_checkout_session_id: checkout.reference }).eq("id", invoiceId!);
  redirect(checkout.url);
}
