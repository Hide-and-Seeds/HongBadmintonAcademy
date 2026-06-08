"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, amount, currency, description, status, students(full_name)")
    .eq("id", id)
    .maybeSingle();

  if (!inv) redirect(`/parent/invoices?error=${encodeURIComponent("Invoice not found.")}`);
  if (inv.status === "paid") redirect(`/parent/invoices?error=${encodeURIComponent("Already paid.")}`);

  const studentName = (inv as any).students?.full_name ?? "your child";

  // Reuse (or create) one Stripe customer per parent — cleaner receipts and a
  // foundation for saved cards / subscriptions later. Non-fatal on failure.
  let customerId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, full_name")
      .eq("id", user.id)
      .maybeSingle();
    try {
      customerId = await findOrCreateCustomer({
        stripeCustomerId: profile?.stripe_customer_id,
        email: user.email,
        name: profile?.full_name,
      });
      if (customerId && customerId !== profile?.stripe_customer_id) {
        await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
      }
    } catch {
      customerId = null; // fall back to customer_email
    }
  }

  const baseUrl = await getBaseUrl();
  const checkout = await getPaymentProvider().createCheckoutSession({
    invoiceId: inv.id,
    amount: Number(inv.amount),
    currency: inv.currency,
    description: inv.description || `Academy fee — ${studentName}`,
    customerEmail: user?.email ?? null,
    customerId,
    successUrl: `${baseUrl}/parent/invoices?paid=1`,
    cancelUrl: `${baseUrl}/parent/invoices`,
  });

  await supabase
    .from("invoices")
    .update({ stripe_checkout_session_id: checkout.reference })
    .eq("id", inv.id);

  redirect(checkout.url);
}
