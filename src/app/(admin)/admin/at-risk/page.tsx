import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getViewBranchId } from "@/lib/branch";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, Section, Avatar, Badge, EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getBaseUrl } from "@/lib/url";
import { waLink } from "@/lib/wa";
import { formatDate } from "@/lib/format";
import { dict } from "@/lib/i18n";
import { nudgeParent } from "./actions";

export const dynamic = "force-dynamic";

const DAY = 86400000;
function mytToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
function daysBetween(fromDate: string, toDate: string): number {
  return Math.floor((Date.parse(toDate) - Date.parse(fromDate)) / DAY);
}

export default async function AtRiskPage() {
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const supabase = await createClient();
  const bf = await getViewBranchId(me);
  const today = mytToday();

  // Active students (branch-scoped by RLS + the super-admin branch focus).
  let sq = supabase.from("students").select("id, full_name, parent_id, photo_url, created_at").eq("status", "active");
  if (bf) sq = sq.eq("branch_id", bf);
  const { data: students } = await sq;
  const list = (students ?? []) as any[];
  const ids = list.map((s) => s.id);

  // Most-recent present/late date per student.
  const { data: att } = ids.length
    ? await supabase.from("attendance").select("student_id, status, sessions(session_date)").in("student_id", ids).limit(20000)
    : { data: [] as any[] };
  const lastSeen = new Map<string, string>();
  for (const a of (att ?? []) as any[]) {
    if (a.status !== "present" && a.status !== "late") continue;
    const d = a.sessions?.session_date as string | undefined;
    if (!d) continue;
    const cur = lastSeen.get(a.student_id);
    if (!cur || d > cur) lastSeen.set(a.student_id, d);
  }

  // At risk = joined >30d ago AND no present/late in the last 30 days (a
  // brand-new student who simply hasn't started isn't "lapsed").
  const risk = list
    .map((s) => {
      const joinedDays = daysBetween(String(s.created_at).slice(0, 10), today);
      const seen = lastSeen.get(s.id) ?? null;
      const daysSince = seen ? daysBetween(seen, today) : joinedDays;
      return { ...s, seen, daysSince, joinedDays };
    })
    .filter((s) => s.joinedDays >= 30 && s.daysSince > 30)
    .sort((a, b) => b.daysSince - a.daysSince);

  const parentIds = [...new Set(risk.map((s) => s.parent_id).filter(Boolean))];
  const { data: parents } = parentIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", parentIds)
    : { data: [] as any[] };
  const parentById = new Map((parents ?? []).map((p: any) => [p.id, p]));

  const baseUrl = await getBaseUrl();
  const winText = (parentName: string, studentName: string, days: number) =>
    L.ar_win_msg
      .replace("{parent}", parentName || L.ar_there)
      .replace("{student}", studentName)
      .replace("{days}", String(days))
      .replace("{url}", `${baseUrl}/parent/schedule`);

  return (
    <div className="space-y-6">
      <PageHeader
        title={L.ar_title}
        description={L.ar_desc}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label={L.ar_at_risk} value={risk.length} tone={risk.length ? "red" : "green"} />
        <StatCard label={L.adm_active_students} value={list.length} tone="slate" />
        <StatCard label={L.ar_retention} value={list.length ? `${Math.round(((list.length - risk.length) / list.length) * 100)}%` : "—"} tone="blue" sub={L.ar_retention_sub} />
      </div>

      <Section title={`${L.ar_reach_out} (${risk.length})`} description={L.ar_oldest_first} flush>
        {risk.length === 0 ? (
          <div className="p-5"><EmptyState message={L.ar_empty} /></div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {risk.map((s) => {
              const p = parentById.get(s.parent_id);
              const wa = waLink(p?.phone, winText(p?.full_name ?? "", s.full_name, s.daysSince));
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <Avatar name={s.full_name} src={s.photo_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/students/${s.id}`} className="font-medium text-slate-900 hover:text-green-700 hover:underline">{s.full_name}</Link>
                    <div className="truncate text-xs text-slate-500">
                      {s.seen ? `${L.ar_last_seen}${formatDate(s.seen)}` : L.ar_never} · {p?.full_name ?? L.ar_no_parent}
                    </div>
                  </div>
                  <Badge tone={s.daysSince >= 60 ? "red" : "yellow"}>{s.daysSince}{L.ar_days_away}</Badge>
                  {wa ? (
                    <a href={wa} target="_blank" rel="noopener" className="inline-flex items-center rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">WhatsApp</a>
                  ) : (
                    <span className="text-xs text-slate-400">{L.ar_no_phone}</span>
                  )}
                  {s.parent_id && (
                    <form action={nudgeParent}>
                      <input type="hidden" name="parent_id" value={s.parent_id} />
                      <input type="hidden" name="student_name" value={s.full_name} />
                      <SubmitButton variant="secondary" pendingText="…">{L.ar_nudge}</SubmitButton>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <p className="text-xs text-slate-400">
        {L.ar_footer_note}
      </p>
    </div>
  );
}
