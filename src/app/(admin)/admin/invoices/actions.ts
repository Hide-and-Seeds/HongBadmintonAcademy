"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, requireSuperAdmin } from "@/lib/auth";
import { invoiceSchema } from "@/lib/validation";
import { generateInvoicesCore } from "@/lib/billing";
import { upsertCommunityMonthlyNotice } from "@/lib/reminders";
import { getMonthlySchedule } from "@/lib/settings";
import { getBaseUrl } from "@/lib/url";
import { getStripe } from "@/lib/payments/stripe";
import { isStripeConfigured } from "@/lib/env";

function err(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createInvoice(formData: FormData) {
  await requireRole("admin");
  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) err("/admin/invoices/new", parsed.error.issues[0].message);
  const supabase = await createClient();

  let parentId = parsed.data.parent_id;
  // Inherit branch (and parent if unset) from the student so the invoice is
  // branch-scoped like everything else.
  let branchId: string | null = null;
  if (parsed.data.student_id) {
    const { data: s } = await supabase
      .from("students")
      .select("parent_id, branch_id")
      .eq("id", parsed.data.student_id)
      .maybeSingle();
    if (!parentId) parentId = s?.parent_id ?? null;
    branchId = (s as any)?.branch_id ?? null;
  }

  // Tag the invoice's arm from its fee plan (academy vs club). No plan → the
  // column default ('academy') applies.
  let business: string | undefined;
  if (parsed.data.fee_plan_id) {
    const { data: fp } = await supabase
      .from("fee_plans")
      .select("business")
      .eq("id", parsed.data.fee_plan_id)
      .maybeSingle();
    business = (fp as any)?.business ?? undefined;
  }

  const { error } = await supabase.from("invoices").insert({
    ...parsed.data,
    parent_id: parentId,
    branch_id: branchId,
    period_month: new Date().toLocaleDateString("en-CA").slice(0, 8) + "01",
    ...(business ? { business } : {}),
  });
  if (error) err("/admin/invoices/new", error.message);

  revalidatePath("/admin/invoices");
  redirect("/admin/invoices");
}

// Manual "Generate this month" button: raise the current month's fee invoices
// for all students on a monthly plan now, instead of waiting for the cron. Same
// idempotent core, so clicking twice won't double-bill.
export async function generateMonthlyInvoices() {
  await requireRole("admin");
  // Honour the admin-set due day (Settings → Monthly schedule) so the manual
  // button and the daily cron raise identical due dates.
  const schedule = await getMonthlySchedule();
  const { generated } = await generateInvoicesCore(createAdminClient(), new Date(), schedule.dueDay);
  // Post/refresh the combined monthly Community notice (reports + fees) — send now.
  const notice = await upsertCommunityMonthlyNotice(await getBaseUrl(), true);
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices?generated=${generated}&notice=${notice.posted}`);
}

export async function markPaid(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id"));
  const supabase = await createClient();

  const { data: inv } = await supabase
    .from("invoices")
    .select("amount, currency, business")
    .eq("id", id)
    .maybeSingle();

  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);

  if (inv) {
    await supabase.from("payments").insert({
      invoice_id: id,
      amount: inv.amount,
      currency: inv.currency,
      provider: "manual",
      status: "succeeded",
      method: "manual",
      business: (inv as any).business ?? "academy",
    });
  }
  revalidatePath("/admin/invoices");
}

// Cancel an unpaid/overdue/draft invoice (no money involved). Paid invoices must
// be refunded instead.
export async function cancelInvoice(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoices").select("status").eq("id", id).maybeSingle();
  if (!inv) err("/admin/invoices", "Invoice not found.");
  if (inv.status === "paid") err("/admin/invoices", "Paid invoices can't be cancelled — use Refund.");
  if (inv.status !== "canceled" && inv.status !== "refunded") {
    await supabase.from("invoices").update({ status: "canceled" }).eq("id", id);
  }
  revalidatePath("/admin/invoices");
}

// Refund a PAID invoice. If it was paid via Stripe, return the money through
// Stripe (refunds.create on the payment intent); the charge.refunded webhook
// then records the refund + flips the invoice. For a manually-marked payment
// there is no money to move — we just set the status to refunded.
export async function refundInvoice(formData: FormData) {
  // Money out — super-admin only.
  await requireSuperAdmin();
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invoices")
    .select("status, stripe_payment_intent_id")
    .eq("id", id)
    .maybeSingle();
  if (!inv) err("/admin/invoices", "Invoice not found.");
  if (inv.status !== "paid") err("/admin/invoices", "Only paid invoices can be refunded.");

  const pi = (inv as { stripe_payment_intent_id?: string | null }).stripe_payment_intent_id ?? null;
  if (pi && isStripeConfigured()) {
    try {
      await getStripe().refunds.create({ payment_intent: pi });
    } catch (e) {
      err("/admin/invoices", `Stripe refund failed: ${(e as Error).message}`);
    }
  }
  await supabase.from("invoices").update({ status: "refunded" }).eq("id", id);
  await supabase.from("payments").update({ status: "refunded" }).eq("invoice_id", id).eq("status", "succeeded");
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices?refunded=${pi ? "stripe" : "manual"}`);
}

export async function deleteInvoice(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("invoices").delete().eq("id", id);
  revalidatePath("/admin/invoices");
}

// WhatsApp click-to-chat: the admin opened wa.me with the reminder; log it.
export async function logReminderSend(formData: FormData) {
  await requireRole("admin");
  const invoice_id = String(formData.get("invoice_id"));
  const recipient_phone = String(formData.get("recipient_phone") ?? "");
  const recipient_profile_id = (formData.get("recipient_profile_id") as string) || null;
  const body = String(formData.get("body") ?? "");

  const supabase = await createClient();
  await supabase.from("messages").insert({
    type: "payment_reminder",
    recipient_profile_id,
    recipient_phone,
    body,
    invoice_id,
    provider: "wa_click",
    status: "sent",
    sent_at: new Date().toISOString(),
  });
  revalidatePath("/admin/invoices");
}
