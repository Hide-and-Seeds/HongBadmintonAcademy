import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";
import { getViewBranchId, listBranches } from "@/lib/branch";
import { PageHeader, Card, Table, Th, Td, cn } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { computePots } from "@/lib/pots";
import { dict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function PotsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  // Revenue split is super-admin only, like the rest of Analytics.
  const me = await requireSuperAdmin();
  const L = dict(me.locale);
  const supabase = await createClient();
  const { month } = await searchParams;
  const nowD = new Date();
  const monthStr = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, "0")}`;
  const [my, mm] = monthStr.split("-").map(Number);
  const thisM = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, "0")}`;

  const bf = await getViewBranchId(me);
  const branches = await listBranches(false);
  const branchLabel = bf ? branches.find((b) => b.id === bf)?.name ?? null : null;

  const p = await computePots(supabase, new Date(my, mm - 1, 1), bf);
  const cur = (n: number) => formatCurrency(n, "MYR");

  const prevM = `${mm === 1 ? my - 1 : my}-${String(mm === 1 ? 12 : mm - 1).padStart(2, "0")}`;
  const nextM = `${mm === 12 ? my + 1 : my}-${String(mm === 12 ? 1 : mm + 1).padStart(2, "0")}`;

  const Arm = ({ label, tone, t }: { label: string; tone: "academy" | "club"; t: typeof p.academy }) => (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span className={cn("inline-block h-2.5 w-2.5 rounded-full", tone === "club" ? "bg-emerald-500" : "bg-blue-500")} />
        <span className="text-sm font-semibold text-slate-700">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{cur(t.collected)}</div>
      <div className="text-xs text-slate-500">{L.pot_collected_month}</div>

      <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
        <div className="flex justify-between text-slate-500"><span>{L.pot_court_cost}</span><span>− {cur(t.courtCost)}</span></div>
        <div className="flex justify-between text-slate-500"><span>{L.pot_salaries}</span><span>− {cur(t.salaries)}</span></div>
        <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900">
          <span>{L.pot_available}</span>
          <span className={cn(t.available < 0 && "text-red-600")}>{cur(t.available)}</span>
        </div>
      </div>

      <div className="mt-3 flex gap-4 text-xs text-slate-400">
        <span>{L.pot_billed} {cur(t.billed)}</span>
        <span>{L.adm_outstanding} <span className={cn(t.outstanding > 0 && "text-amber-600")}>{cur(t.outstanding)}</span></span>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={L.pot_title}
        description={L.pot_desc}
      />

      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <Link href={`/admin/pots?month=${prevM}`} aria-label={L.cs_prev_month} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-900">{p.monthLabel}{branchLabel ? ` · ${branchLabel}` : ""}</div>
          {monthStr !== thisM && (
            <Link href={`/admin/pots?month=${thisM}`} className="text-xs font-medium text-green-700 hover:underline">{L.pot_back_month}</Link>
          )}
        </div>
        <Link href={`/admin/pots?month=${nextM}`} aria-label={L.cs_next_month} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Arm label={L.cr_academy} tone="academy" t={p.academy} />
        <Arm label={L.cr_club} tone="club" t={p.club} />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>{L.pot_line}</Th><Th className="text-right">{L.cr_academy}</Th><Th className="text-right">{L.cr_club}</Th><Th className="text-right">{L.total_word}</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td label={L.pot_line}>{L.coll_collected}</Td>
              <Td className="text-right" label={L.cr_academy}>{cur(p.academy.collected)}</Td>
              <Td className="text-right" label={L.cr_club}>{cur(p.club.collected)}</Td>
              <Td className="text-right font-medium" label={L.total_word}>{cur(p.total.collected)}</Td>
            </tr>
            <tr>
              <Td label={L.pot_line}>{L.pot_billed}</Td>
              <Td className="text-right" label={L.cr_academy}>{cur(p.academy.billed)}</Td>
              <Td className="text-right" label={L.cr_club}>{cur(p.club.billed)}</Td>
              <Td className="text-right font-medium" label={L.total_word}>{cur(p.total.billed)}</Td>
            </tr>
            <tr>
              <Td label={L.pot_line}>{L.pot_court_cost}</Td>
              <Td className="text-right text-slate-500" label={L.cr_academy}>− {cur(p.academy.courtCost)}</Td>
              <Td className="text-right text-slate-500" label={L.cr_club}>− {cur(p.club.courtCost)}</Td>
              <Td className="text-right font-medium text-slate-500" label={L.total_word}>− {cur(p.total.courtCost)}</Td>
            </tr>
            <tr>
              <Td label={L.pot_line}>{L.pot_salaries}</Td>
              <Td className="text-right text-slate-500" label={L.cr_academy}>− {cur(p.academy.salaries)}</Td>
              <Td className="text-right text-slate-500" label={L.cr_club}>− {cur(p.club.salaries)}</Td>
              <Td className="text-right font-medium text-slate-500" label={L.total_word}>− {cur(p.total.salaries)}</Td>
            </tr>
            <tr className="bg-slate-50">
              <Td label={L.pot_line} className="font-semibold text-slate-900">{L.pot_available}</Td>
              <Td className="text-right font-semibold text-slate-900" label={L.cr_academy}>{cur(p.academy.available)}</Td>
              <Td className="text-right font-semibold text-slate-900" label={L.cr_club}>{cur(p.club.available)}</Td>
              <Td className="text-right font-bold text-slate-900" label={L.total_word}>{cur(p.total.available)}</Td>
            </tr>
            <tr>
              <Td label={L.pot_line} className="text-slate-400">{L.adm_outstanding}</Td>
              <Td className="text-right text-slate-400" label={L.cr_academy}>{cur(p.academy.outstanding)}</Td>
              <Td className="text-right text-slate-400" label={L.cr_club}>{cur(p.club.outstanding)}</Td>
              <Td className="text-right text-slate-400" label={L.total_word}>{cur(p.total.outstanding)}</Td>
            </tr>
          </tbody>
        </Table>
      </Card>

      <p className="px-1 text-xs text-slate-400">
        {L.pot_footer}
      </p>
    </div>
  );
}
