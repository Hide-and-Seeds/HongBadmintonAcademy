"use server";

import { redirect } from "next/navigation";
import { requireParent } from "@/lib/parent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/payments";
import { findOrCreateCustomer } from "@/lib/payments/stripe";
import { isStripeConfigured } from "@/lib/env";
import { getBaseUrl } from "@/lib/url";

// Parent pays an invoice → create a Stripe Checkout session and redirect to it.
export async function payInvoice(formData: FormData) {
  const id = String(formData.get("id"));

  if (!isStripeConfigured()) {
    redirect(`/parent/invoices?error=${encodeURIComponent("Online payment is not configured yet.")}`);
  }

  const me = await requireParent();
  const db = createAdminClient();

  const { data: inv } = await db
    .from("invoices")
    .select("id, amount, currency, description, status, parent_id, business, students(full_name)")
    .eq("id", id)
    .eq("parent_id", me.id)
    .maybeSingle();

  if (!inv) redirect(`/parent/invoices?error=${encodeURIComponent("Invoice not found.")}`);
  // Defence in depth: this parent must own the invoice.
  if (inv.parent_id !== me.id) {
    redirect(`/parent/invoices?error=${encodeURIComponent("Not your invoice.")}`);
  }
  if (inv.status === "paid") redirect(`/parent/invoices?error=${encodeURIComponent("Already paid.")}`);

  const studentName = (inv as any).students?.full_name ?? "your child";

  // Reuse (or create) one Stripe customer per parent — cleaner receipts and a
  // foundation for saved cards / subscriptions later. Non-fatal on failure.
  let customerId: string | null = null;
  const { data: profile } = await db
    .from("profiles")
    .select("stripe_customer_id, full_name, email")
    .eq("id", me.id)
    .maybeSingle();
  try {
    customerId = await findOrCreateCustomer({
      stripeCustomerId: profile?.stripe_customer_id,
      email: profile?.email,
      name: profile?.full_name,
    });
    if (customerId && customerId !== profile?.stripe_customer_id) {
      await db.from("profiles").update({ stripe_customer_id: customerId }).eq("id", me.id);
    }
  } catch {
    customerId = null; // fall back to customer_email
  }

  const baseUrl = await getBaseUrl();
  const checkout = await getPaymentProvider().createCheckoutSession({
    invoiceId: inv.id,
    amount: Number(inv.amount),
    currency: inv.currency,
    description: inv.description || `Academy fee — ${studentName}`,
    business: ((inv as any).business as "academy" | "club") ?? "academy",
    customerEmail: profile?.email ?? null,
    customerId,
    successUrl: `${baseUrl}/parent/invoices?paid=1`,
    cancelUrl: `${baseUrl}/parent/invoices`,
  });

  await db
    .from("invoices")
    .update({ stripe_checkout_session_id: checkout.reference })
    .eq("id", inv.id);

  redirect(checkout.url);
}
