import "server-only";
import Stripe from "stripe";
import { env, isStripeConfigured } from "@/lib/env";
import type { CheckoutInput, CheckoutResult, PaymentProvider } from "./types";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured (set STRIPE_SECRET_KEY).");
  }
  if (!_stripe) {
    _stripe = new Stripe(env.stripeSecret, {
      appInfo: { name: "Hong Badminton Academy", url: env.appUrl },
    });
  }
  return _stripe;
}

/** "test" | "live" — derived from the secret key prefix. */
export function stripeMode(): "test" | "live" | "unknown" {
  if (env.stripeSecret.startsWith("sk_live")) return "live";
  if (env.stripeSecret.startsWith("sk_")) return "test";
  return "unknown";
}

/** Reuse a valid existing Stripe customer, else create one. Returns its id. */
export async function findOrCreateCustomer(opts: {
  stripeCustomerId?: string | null;
  email?: string | null;
  name?: string | null;
}): Promise<string> {
  const stripe = getStripe();
  if (opts.stripeCustomerId) {
    try {
      const c = await stripe.customers.retrieve(opts.stripeCustomerId);
      if (c && !(c as { deleted?: boolean }).deleted) return opts.stripeCustomerId;
    } catch {
      // missing/deleted — fall through and create a fresh one
    }
  }
  const created = await stripe.customers.create({
    email: opts.email ?? undefined,
    name: opts.name ?? undefined,
  });
  return created.id;
}

/** Create/refresh a Stripe Product + Price mirroring a fee plan. */
export async function syncFeePlanToStripe(plan: {
  id: string;
  name: string;
  description?: string | null;
  amount: number;
  currency: string;
  interval: "monthly" | "one_time";
  stripe_product_id?: string | null;
}): Promise<{ productId: string; priceId: string }> {
  const stripe = getStripe();

  let productId = plan.stripe_product_id ?? null;
  if (productId) {
    try {
      const p = await stripe.products.retrieve(productId);
      if (!p || (p as { deleted?: boolean }).deleted) productId = null;
    } catch {
      productId = null;
    }
  }

  if (!productId) {
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description ?? undefined,
      metadata: { fee_plan_id: plan.id },
    });
    productId = product.id;
  } else {
    await stripe.products.update(productId, {
      name: plan.name,
      description: plan.description ?? undefined,
    });
  }

  // Prices are immutable in Stripe — always create a fresh one for the current
  // amount. Monthly plans get a recurring price (usable for subscriptions later).
  const price = await stripe.prices.create({
    product: productId,
    currency: plan.currency.toLowerCase(),
    unit_amount: Math.round(plan.amount * 100),
    ...(plan.interval === "monthly" ? { recurring: { interval: "month" as const } } : {}),
    metadata: { fee_plan_id: plan.id },
  });

  return { productId, priceId: price.id };
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    const stripe = getStripe();
    // Proposal v7 §5.4: parents can select FPX (direct bank transfer), card,
    // or supported e-wallets. For MYR we ask for all three explicitly; for any
    // other currency, fall back to whatever the Stripe Dashboard has enabled.
    const isMYR = input.currency.toLowerCase() === "myr";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: input.invoiceId,
      ...(input.customerId
        ? { customer: input.customerId }
        : { customer_email: input.customerEmail ?? undefined }),
      ...(isMYR
        ? { payment_method_types: ["card", "fpx", "grabpay"] as const }
        : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: Math.round(input.amount * 100), // major → minor units
            product_data: { name: input.description },
          },
        },
      ],
      metadata: { invoice_id: input.invoiceId, business: input.business ?? "academy" },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url, reference: session.id };
  },
};
