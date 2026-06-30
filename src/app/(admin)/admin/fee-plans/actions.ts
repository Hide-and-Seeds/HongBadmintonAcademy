"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";
import { feePlanSchema } from "@/lib/validation";
import { isStripeConfigured } from "@/lib/env";
import { syncFeePlanToStripe } from "@/lib/payments/stripe";

function err(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createFeePlan(formData: FormData) {
  await requireSuperAdmin();
  const parsed = feePlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) err("/admin/fee-plans/new", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.from("fee_plans").insert(parsed.data);
  if (error) err("/admin/fee-plans/new", error.message);
  revalidatePath("/admin/fee-plans");
  redirect("/admin/fee-plans");
}

export async function updateFeePlan(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("id"));
  const parsed = feePlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) err(`/admin/fee-plans/${id}`, parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.from("fee_plans").update(parsed.data).eq("id", id);
  if (error) err(`/admin/fee-plans/${id}`, error.message);
  revalidatePath("/admin/fee-plans");
  redirect("/admin/fee-plans");
}

export async function deleteFeePlan(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("fee_plans").delete().eq("id", id);
  revalidatePath("/admin/fee-plans");
}

// Mirror every active fee plan into the Stripe product/price catalog and store
// the resulting ids. Idempotent — re-running refreshes products + adds a price.
export async function syncFeePlansToStripe() {
  await requireSuperAdmin();
  if (!isStripeConfigured()) err("/admin/fee-plans", "Stripe is not configured (set STRIPE_SECRET_KEY).");
  const supabase = await createClient();
  const { data: plans, error } = await supabase
    .from("fee_plans")
    .select("id, name, description, amount, currency, interval, stripe_product_id")
    .eq("is_active", true);
  if (error) err("/admin/fee-plans", error.message);

  let synced = 0;
  for (const p of plans ?? []) {
    try {
      const { productId, priceId } = await syncFeePlanToStripe({
        id: p.id,
        name: p.name,
        description: p.description,
        amount: Number(p.amount),
        currency: p.currency,
        interval: p.interval,
        stripe_product_id: p.stripe_product_id,
      });
      await supabase
        .from("fee_plans")
        .update({ stripe_product_id: productId, stripe_price_id: priceId })
        .eq("id", p.id);
      synced++;
    } catch (e) {
      err("/admin/fee-plans", `Sync failed for "${p.name}": ${(e as Error).message}`);
    }
  }

  revalidatePath("/admin/fee-plans");
  redirect(`/admin/fee-plans?synced=${synced}`);
}
