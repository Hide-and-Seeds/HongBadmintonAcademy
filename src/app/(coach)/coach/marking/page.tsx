import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section, Badge, EmptyState, LinkButton } from "@/components/ui";
import { monthLabel, currentWeekStartMYT } from "@/lib/format";
import { coachClassIds } from "../_data";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function monthBounds() {
  const now = new Date(Date.now() + 8 * 3600 * 1000); // MYT
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return { start: `${y}-${String(m + 1).padStart(2, "0")}-01`, end: new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10) };
}

export default async function MarkingListPage() {
  const me = await requireRole("coach");
  const supabase = await createClient();
  const classIds = await coachClassIds(supabase, me.id);
  const { start, end } = monthBounds();

  const weekStart = currentWeekStartMYT();
  const groups: { className: string; students: { id: string; full_name: string }[] }[] = [];
  const assessed = new Set<string>();
  const markedWeek = new Map<string, number>(); // student_id → this week's rating

  if (classIds.length) {
    const { data: enr } = await supabase
      .from("enrollments")
      .select("student_id, students(id, full_name), classes(id, name)")
      .in("class_id", classIds)
      .eq("active", true);

    const byClass = new Map<string, { className: string; students: { id: string; full_name: string }[] }>();
    const studentIds = new Set<string>();
    for (const e of enr ?? []) {
      const s = (e as any).students;
      const c = (e as any).classes;
      if (!s || !c) continue;
      studentIds.add(s.id);
      let g = byClass.get(c.id);
      if (!g) { g = { className: c.name, students: [] }; byClass.set(c.id, g); }
      g.students.push(s);
    }
    for (const g of byClass.values()) {
      g.students.sort((a, b) => a.full_name.localeCompare(b.full_name));
      groups.push(g);
    }
    groups.sort((a, b) => a.className.localeCompare(b.className));

    if (studentIds.size) {
      const { data: asd } = await supabase
        .from("assessments")
        .select("student_id")
        .in("student_id", [...studentIds])
        .gte("assessed_on", start)
        .lte("assessed_on", end);
      for (const a of asd ?? []) assessed.add(a.student_id);

      // Per-session marks for this week's sessions roll up into a weekly average
      // shown per student (marks are entered on the Attendance screen).
      const { data: wkSessions } = await supabase
        .from("sessions")
        .select("id")
        .in("class_id", classIds)
        .gte("session_date", weekStart);
      const wkSessionIds = (wkSessions ?? []).map((s: any) => s.id);

      if (wkSessionIds.length) {
        const { data: sm } = await supabase
          .from("session_marks")
          .select("student_id, rating")
          .in("session_id", wkSessionIds)
          .in("student_id", [...studentIds]);
        const agg = new Map<string, { sum: number; n: number }>();
        for (const m of (sm ?? []) as any[]) {
          const e = agg.get(m.student_id) ?? { sum: 0, n: 0 };
          e.sum += m.rating;
          e.n += 1;
          agg.set(m.student_id, e);
        }
        for (const [sid, e] of agg) markedWeek.set(sid, Math.round((e.sum / e.n) * 10) / 10);
      }
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marking"
        description={`Monthly assessment for ${monthLabel(start)}. Quick per-session marks are entered on the Attendance screen; the weekly average shows here.`}
      />

      {groups.length === 0 ? (
        <EmptyState message="No students assigned to your classes yet." />
      ) : (
        groups.map((g) => (
          <Section key={g.className} title={g.className} flush>
            <ul className="divide-y divide-slate-100">
              {g.students.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                      {initials(s.full_name)}
                    </span>
                    <span className="truncate font-medium text-slate-900">{s.full_name}</span>
                    {assessed.has(s.id) ? <Badge tone="green">month ✓</Badge> : <Badge tone="slate">month —</Badge>}
                    {markedWeek.has(s.id) ? <Badge tone="blue">wk {markedWeek.get(s.id)}/5</Badge> : <Badge tone="slate">wk —</Badge>}
                  </div>
                  <LinkButton href={`/coach/marking/${s.id}`} variant="secondary" className="shrink-0 !px-3 !py-1.5 text-xs">
                    {assessed.has(s.id) ? "View / re-mark" : "Mark"}
                  </LinkButton>
                </li>
              ))}
            </ul>
          </Section>
        ))
      )}
    </div>
  );
}
