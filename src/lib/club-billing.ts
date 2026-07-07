import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthLabel } from "@/lib/format";

// First calendar day (YYYY-MM-DD) of the month containing `d`.
function monthStart(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA");
}

// Raise the monthly membership invoice for every ACTIVE club member on a MONTHLY
// club tier. Idempotent: the (club_member_id, period_month, fee_plan_id) unique
// index + upsert ignore means re-runs (or the manual button) never double-bill.
// Mirrors generateInvoicesCore for students. No proration — memberships bill the
// full month. Invoices are business='club', so they flow into /admin/pots.
export async function generateClubDuesCore(
  db: SupabaseClient,
  month: Date = new Date(),
  dueDay: number = 7,
): Promise<{ eligible: number; generated: number }> {
  const period = monthStart(month);
  const dueDate = new Date(month.getFullYear(), month.getMonth(), dueDay).toLocaleDateString("en-CA");
  const label = monthLabel(period);

  const { data: members, error } = await db
    .from("club_members")
    .select("id, branch_id, tier:fee_plans!club_members_tier_id_fkey(id, name, amount, currency, interval, is_active, business)")
    .eq("status", "active")
    .not("tier_id", "is", null);
  if (error) throw new Error(error.message);

  const eligible = (members ?? []).filter((m: any) => {
    const t = m.tier;
    return t && t.is_active && t.business === "club" && t.interval === "monthly";
  });
  if (eligible.length === 0) return { eligible: 0, generated: 0 };

  const rows = eligible.map((m: any) => ({
    club_member_id: m.id,
    fee_plan_id: m.tier.id,
    branch_id: m.branch_id ?? null,
    amount: m.tier.amount,
    currency: m.tier.currency,
    business: "club",
    period_month: period,
    due_date: dueDate,
    description: `Club membership — ${m.tier.name} · ${label}`,
    status: "unpaid",
  }));

  const { data: inserted, error: upErr } = await db
    .from("invoices")
    .upsert(rows, { onConflict: "club_member_id,period_month,fee_plan_id", ignoreDuplicates: true })
    .select("id");
  if (upErr) throw new Error(upErr.message);

  return { eligible: rows.length, generated: inserted?.length ?? 0 };
}
