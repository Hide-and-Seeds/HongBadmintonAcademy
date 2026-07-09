import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getViewBranchId, listBranches } from "@/lib/branch";

export const runtime = "nodejs";

function branchSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function esc(v: string | number): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Court rental cost extract — super-admin only (academy finance). RLS on
// court_rentals also enforces is_super_admin().
export async function GET(req: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const monthParam = new URL(req.url).searchParams.get("month");
  const valid = monthParam && /^\d{4}-\d{2}$/.test(monthParam);
  const monthStr = valid ? monthParam! : new Date().toISOString().slice(0, 7);
  const [y, m] = monthStr.split("-").map(Number);
  const start = `${monthStr}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  // Scope to the sidebar branch focus (null = all), matching the on-screen page.
  const bf = await getViewBranchId(profile);
  const branchName = bf ? ((await listBranches(false)).find((b) => b.id === bf)?.name ?? null) : null;
  let q = supabase
    .from("court_rentals")
    .select("rental_date, hours, amount, note, courts(name)")
    .gte("rental_date", start)
    .lte("rental_date", end)
    .order("rental_date");
  if (bf) q = q.eq("branch_id", bf);
  const { data } = await q;

  const headers = ["Date", "Court", "Hours", "Amount", "Note"];
  const rows = ((data ?? []) as any[]).map((r) => [r.rental_date, r.courts?.name ?? "", Number(r.hours), Number(r.amount), r.note ?? ""]);
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hba-court-rentals${branchName ? `-${branchSlug(branchName)}` : ""}-${monthStr}.csv"`,
    },
  });
}
