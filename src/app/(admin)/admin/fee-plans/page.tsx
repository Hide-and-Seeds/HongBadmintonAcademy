import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { PageHeader, Section, LinkButton, Table, Th, Td, Badge, EmptyState, cn } from "@/components/ui";
import { rankBadgeClass } from "@/lib/ranks";
import { dict } from "@/lib/i18n";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { formatCurrency } from "@/lib/format";
import { isStripeConfigured, env } from "@/lib/env";
import { stripeMode } from "@/lib/payments/stripe";
import { deleteFeePlan, syncFeePlansToStripe } from "./actions";

export const dynamic = "force-dynamic";

export default async function FeePlansPage({
  searchParams,
}: {
  searchParams: Promise<{ synced?: string; error?: string }>;
}) {
  const { synced, error } = await searchParams;
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const supabase = await createClient();
  const { data: plans } = await supabase.from("fee_plans").select("*").order("name");

  const configured = isStripeConfigured();
  const mode = stripeMode();
  const webhookSet = !!env.stripeWebhookSecret;

  return (
    <div>
      <PageHeader
        title={L.fp_title}
        description={L.fp_desc}
        action={
          <>
            <form action={syncFeePlansToStripe}>
              <SubmitButton variant="secondary" pendingText={L.fp_syncing}>{L.fp_sync}</SubmitButton>
            </form>
            <LinkButton href="/admin/fee-plans/new">{L.fp_new}</LinkButton>
          </>
        }
      />

      {/* Stripe status */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <span className="font-medium text-slate-700">Stripe</span>
        {configured ? (
          <Badge tone={mode === "live" ? "green" : "blue"}>{mode === "live" ? L.fp_live_mode : L.fp_test_mode}</Badge>
        ) : (
          <Badge tone="yellow">{L.fp_not_configured}</Badge>
        )}
        <Badge tone={webhookSet ? "green" : "slate"}>{webhookSet ? L.fp_webhook_set : L.fp_no_webhook}</Badge>
        {!configured && (
          <span className="text-slate-500">{L.fp_stripe_hint}</span>
        )}
      </div>

      {synced && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {L.fp_synced.replace("{n}", synced)}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {plans && plans.length > 0 ? (
        <Section title={`${L.fp_section} (${plans.length})`} flush>
          <Table>
            <thead>
              <tr>
                <Th>{L.col_name}</Th>
                <Th>{L.fp_rank}</Th>
                <Th>{L.fp_amount}</Th>
                <Th>{L.fp_billing}</Th>
                <Th>{L.fp_stripe_col}</Th>
                <Th className="text-right">{L.col_actions}</Th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{p.name}</Td>
                  <Td label={L.fp_rank}>
                    {p.rank ? (
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", rankBadgeClass(p.rank))}>{p.rank}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td label={L.fp_amount} className="font-medium text-slate-900">{formatCurrency(Number(p.amount), p.currency)}</Td>
                  <Td label={L.fp_billing}>
                    <Badge tone="blue">{p.interval === "one_time" ? L.fp_one_time : p.interval === "monthly" ? L.fp_monthly : p.interval}</Badge>
                  </Td>
                  <Td label={L.fp_stripe_col}>
                    {p.stripe_price_id ? <Badge tone="green">{L.fp_synced_badge}</Badge> : <Badge tone="slate">—</Badge>}
                  </Td>
                  <Td label={L.col_actions} className="text-right">
                    <div className="flex justify-end gap-2">
                      <LinkButton href={`/admin/fee-plans/${p.id}`} variant="secondary">
                        {L.edit_btn}
                      </LinkButton>
                      <form action={deleteFeePlan}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmButton label={L.del_word} confirmText={L.fp_delete_confirm.replace("{name}", p.name)} />
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      ) : (
        <EmptyState message={L.fp_empty} />
      )}
    </div>
  );
}
