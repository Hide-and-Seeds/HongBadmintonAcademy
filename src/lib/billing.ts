import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthLabel } from "@/lib/format";

// First calendar day (YYYY-MM-DD) of the month containing `d`.
function monthStart(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA");
}

// Default day-of-month the auto-raised fee falls due (admin-overridable).
const DEFAULT_DUE_DAY = 7;

// Raise the monthly fee invoice for every active student that has a *monthly*
// fee plan assigned. Idempotent: the (student_id, period_month, fee_plan_id)
// unique index + upsert ignore means re-runs (or the manual force button) never
// double-bill. Mirrors generateScorecardsCore.
//
// Mid-month joiners are **prorated by sessions**: their first month's fee =
// plan × (sessions they can still attend after joining ÷ all of that month's
// sessions for their class). Because proration keys off `enrolled_at`, only the
// first month prorates — in later months they enrolled before the period start
// and bill the full amount automatically (no extra state to track).
//
// `db`     — RLS client (manual admin path) or service-role client (headless cron).
// `month`  — any date within the month to bill (defaults to the current month).
// `dueDay` — day of month the invoice is due (defaults to the 7th).
export async function generateInvoicesCore(
  db: SupabaseClient,
  month: Date = new Date(),
  dueDay: number = DEFAULT_DUE_DAY,
): Promise<{ eligible: number; generated: number }> {
  const period = monthStart(month);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0).toLocaleDateString("en-CA");
  const dueDate = new Date(month.getFullYear(), month.getMonth(), dueDay).toLocaleDateString("en-CA");
  const label = monthLabel(period);

  const { data: students, error } = await db
    .from("students")
    .select(
      "id, parent_id, fee_plan_id, fee_plan:fee_plans!students_fee_plan_id_fkey(amount, currency, interval, is_active)",
    )
    .eq("status", "active")
    .not("fee_plan_id", "is", null);
  if (error) throw new Error(error.message);

  const eligible = (students ?? []).filter((s) => {
    const plan = (s as any).fee_plan;
    return plan && plan.is_active && plan.interval === "monthly";
  });
  if (eligible.length === 0) return { eligible: 0, generated: 0 };

  // For proration we need, per student: when they joined (earliest active
  // enrolment) and how many of this month's sessions fall on/after that day.
  const studentIds = eligible.map((s) => s.id);
  const { data: enrolls } = await db
    .from("enrollments")
    .select("student_id, class_id, enrolled_at")
    .eq("active", true)
    .in("student_id", studentIds);

  const classIds = [...new Set((enrolls ?? []).map((e: any) => e.class_id))];
  const { data: sess } = classIds.length
    ? await db
        .from("sessions")
        .select("class_id, session_date")
        .neq("status", "canceled")
        .gte("session_date", period)
        .lte("session_date", monthEnd)
        .in("class_id", classIds)
    : { data: [] as any[] };

  const enrollsByStudent = new Map<string, { class_id: string; enrolled_at: string }[]>();
  for (const e of (enrolls ?? []) as any[]) {
    const arr = enrollsByStudent.get(e.student_id) ?? [];
    arr.push({ class_id: e.class_id, enrolled_at: e.enrolled_at });
    enrollsByStudent.set(e.student_id, arr);
  }
  const datesByClass = new Map<string, string[]>();
  for (const s of (sess ?? []) as any[]) {
    const arr = datesByClass.get(s.class_id) ?? [];
    arr.push(s.session_date);
    datesByClass.set(s.class_id, arr);
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const s of eligible) {
    const plan = (s as any).fee_plan;
    let amount: number = plan.amount;
    let suffix = "";

    const myEnrolls = enrollsByStudent.get(s.id) ?? [];
    if (myEnrolls.length) {
      // Join date = earliest active enrolment (UTC calendar day).
      const joinDate = myEnrolls.map((e) => String(e.enrolled_at).slice(0, 10)).sort()[0];
      // Only prorate when they joined strictly after the 1st of this month.
      if (joinDate > period) {
        const myClassIds = new Set(myEnrolls.map((e) => e.class_id));
        let total = 0;
        let remaining = 0;
        for (const cid of myClassIds) {
          for (const d of datesByClass.get(cid) ?? []) {
            total++;
            if (d >= joinDate) remaining++;
          }
        }
        if (total > 0) {
          if (remaining === 0) continue; // joined after the month's last session — bill next month
          amount = Math.round(plan.amount * (remaining / total) * 100) / 100;
          suffix = ` (prorated ${remaining}/${total} sessions)`;
        }
        // total === 0 (no scheduled sessions yet) → fall through and bill full.
      }
    }

    rows.push({
      student_id: s.id,
      parent_id: (s as any).parent_id,
      fee_plan_id: (s as any).fee_plan_id,
      amount,
      currency: plan.currency,
      period_month: period,
      due_date: dueDate,
      description: `Monthly fee — ${label}${suffix}`,
      status: "unpaid",
    });
  }

  if (rows.length === 0) return { eligible: 0, generated: 0 };

  // ON CONFLICT DO NOTHING via ignoreDuplicates; .select() returns only the rows
  // actually inserted, so its length is the real count of new invoices.
  const { data: inserted, error: upErr } = await db
    .from("invoices")
    .upsert(rows, { onConflict: "student_id,period_month,fee_plan_id", ignoreDuplicates: true })
    .select("id");
  if (upErr) throw new Error(upErr.message);

  return { eligible: rows.length, generated: inserted?.length ?? 0 };
}
