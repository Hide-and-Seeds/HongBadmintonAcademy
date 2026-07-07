import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { joinClub } from "./actions";

export const dynamic = "force-dynamic";

export default async function ClubJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // Public page — read club tiers with the service-role client (pricing is
  // public anyway). Only active CLUB fee plans are offered.
  const db = createAdminClient();
  const { data: tiers } = await db
    .from("fee_plans")
    .select("id, name, description, amount, currency, interval")
    .eq("business", "club")
    .eq("is_active", true)
    .order("amount");

  const list = tiers ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-5 py-10">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white">HBA</div>
        <h1 className="text-2xl font-bold text-slate-900">Join the club</h1>
        <p className="mt-1 text-sm text-slate-500">Membership, social play and court access. Sign up and pay online — takes a minute.</p>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {list.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Club memberships open soon. Please check back.
        </div>
      ) : (
        <form action={joinClub} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
            <label>Company<input type="text" name="company" tabIndex={-1} autoComplete="off" /></label>
          </div>
          <div className="space-y-3">
            <span className="block text-sm font-medium text-slate-700">Choose your membership</span>
            {list.map((t: any, i: number) => (
              <label key={t.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-emerald-300 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50">
                <input type="radio" name="tier_id" value={t.id} defaultChecked={i === 0} required className="mt-1" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{t.name}</span>
                    <span className="shrink-0 font-semibold text-emerald-700">
                      {formatCurrency(Number(t.amount), t.currency)}
                      <span className="text-xs font-normal text-slate-400">{t.interval === "monthly" ? "/mo" : ""}</span>
                    </span>
                  </span>
                  {t.description && <span className="mt-0.5 block text-xs text-slate-500">{t.description}</span>}
                </span>
              </label>
            ))}
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Full name</span>
              <input name="full_name" required className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
              <input type="email" name="email" required className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Phone <span className="font-normal text-slate-400">(optional)</span></span>
              <input name="phone" inputMode="tel" className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </label>
          </div>

          <SubmitButton pendingText="Redirecting to payment…">Continue to payment</SubmitButton>
          <p className="text-center text-xs text-slate-400">You&apos;ll be taken to our secure payment page. Your membership activates once payment is received.</p>
        </form>
      )}
    </main>
  );
}
