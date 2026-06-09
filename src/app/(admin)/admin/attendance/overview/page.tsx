import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, LinkButton, EmptyState, cn } from "@/components/ui";

export const dynamic = "force-dynamic";

// 4-month terms: Jan–Apr · May–Aug · Sep–Dec.
function termOf(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getUTCFullYear();
  const block = d.getUTCMonth() < 4 ? 0 : d.getUTCMonth() < 8 ? 1 : 2;
  const startM = block * 4;
  const start = `${y}-${String(startM + 1).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(y, startM + 4, 0)).toISOString().slice(0, 10);
  const A = ["Jan", "May", "Sep"][block];
  const B = ["Apr", "Aug", "Dec"][block];
  return { key: `${y}-${block}`, label: `${A}–${B} ${y}`, start, end, sort: y * 10 + block };
}

type Agg = { lessons: number; att: number; marked: number };

export default async function SessionsOverviewPage() {
  const supabase = await createClient();

  const [{ data: classes }, { data: sessions }, { data: enr }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("is_active", true).order("name"),
    supabase.from("sessions").select("id, class_id, session_date"),
    supabase.from("enrollments").select("class_id").eq("active", true),
  ]);

  const sessionIds = (sessions ?? []).map((s: any) => s.id);
  const { data: att } = sessionIds.length
    ? await supabase.from("attendance").select("session_id, status").in("session_id", sessionIds)
    : { data: [] as any[] };

  const attBySession = new Map<string, { att: number; marked: number }>();
  for (const a of att ?? []) {
    const e = attBySession.get(a.session_id) ?? { att: 0, marked: 0 };
    e.marked++;
    if (a.status === "present" || a.status === "late") e.att++;
    attBySession.set(a.session_id, e);
  }

  const enrollCount = new Map<string, number>();
  for (const e of enr ?? []) enrollCount.set(e.class_id, (enrollCount.get(e.class_id) ?? 0) + 1);

  // term key -> { meta, perClass: classId -> Agg }
  const terms = new Map<string, { label: string; start: string; end: string; sort: number; perClass: Map<string, Agg> }>();
  for (const s of sessions ?? []) {
    const t = termOf(s.session_date);
    let row = terms.get(t.key);
    if (!row) {
      row = { label: t.label, start: t.start, end: t.end, sort: t.sort, perClass: new Map() };
      terms.set(t.key, row);
    }
    let pc = row.perClass.get(s.class_id);
    if (!pc) { pc = { lessons: 0, att: 0, marked: 0 }; row.perClass.set(s.class_id, pc); }
    pc.lessons++;
    const a = attBySession.get(s.id);
    if (a) { pc.att += a.att; pc.marked += a.marked; }
  }

  const termRows = [...terms.values()].sort((a, b) => b.sort - a.sort);
  const cols = classes ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sessions Overview"
        description="Attendance by term (Jan–Apr · May–Aug · Sep–Dec), per class."
        action={<LinkButton href="/admin/attendance" variant="ghost">← Sessions</LinkButton>}
      />

      {termRows.length === 0 || cols.length === 0 ? (
        <EmptyState message="No sessions yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th rowSpan={2} className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Term</th>
                <th rowSpan={2} className="border-b border-slate-200 px-3 py-2 text-left text-[11px] font-medium text-slate-400">Start</th>
                <th rowSpan={2} className="border-b border-r border-slate-200 px-3 py-2 text-left text-[11px] font-medium text-slate-400">End</th>
                {cols.map((c: any) => (
                  <th key={c.id} colSpan={3} className="border-b border-r border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-700">{c.name}</th>
                ))}
              </tr>
              <tr className="bg-slate-50">
                {cols.map((c: any) => (
                  <Fragment key={c.id}>
                    <th className="border-b border-slate-200 px-2 py-1.5 text-center text-[10px] font-semibold uppercase text-slate-400">Students</th>
                    <th className="border-b border-slate-200 px-2 py-1.5 text-center text-[10px] font-semibold uppercase text-slate-400">Lsn</th>
                    <th className="border-b border-r border-slate-200 px-2 py-1.5 text-center text-[10px] font-semibold uppercase text-slate-400">%</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {termRows.map((t) => (
                <tr key={t.label} className="hover:bg-slate-50">
                  <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-2 font-medium text-slate-900">{t.label}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-500">{t.start}</td>
                  <td className="border-b border-r border-slate-100 px-3 py-2 text-slate-500">{t.end}</td>
                  {cols.map((c: any) => {
                    const pc = t.perClass.get(c.id);
                    const pct = pc && pc.marked ? Math.round((pc.att / pc.marked) * 100) : null;
                    return (
                      <Fragment key={c.id}>
                        <td className="border-b border-slate-100 px-2 py-2 text-center text-slate-600">{enrollCount.get(c.id) ?? 0}</td>
                        <td className="border-b border-slate-100 px-2 py-2 text-center text-slate-600">{pc?.lessons ?? 0}</td>
                        <td className={cn("border-b border-r border-slate-100 px-2 py-2 text-center font-semibold", pct == null ? "text-slate-300" : pct >= 80 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600")}>
                          {pct == null ? "—" : `${pct}%`}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
