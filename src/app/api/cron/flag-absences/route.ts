import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";

export const runtime = "nodejs";

// Scheduled sweep (Vercel Cron): finalises finished sessions — marks late
// tap-ins and inserts absent rows for no-shows — and flips past-due unpaid
// invoices to "overdue" so status filters and dashboards tell the truth
// (previously overdue was only ever derived at render time). See vercel.json.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc("flag_due_absences");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Overdue sweep — MYT calendar day; unpaid + due before today → overdue.
  const todayMYT = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: flipped, error: invErr } = await db
    .from("invoices")
    .update({ status: "overdue" })
    .eq("status", "unpaid")
    .lt("due_date", todayMYT)
    .select("id");
  if (invErr) {
    return NextResponse.json({ ok: false, error: invErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessions_processed: data, invoices_overdue: flipped?.length ?? 0 });
}
