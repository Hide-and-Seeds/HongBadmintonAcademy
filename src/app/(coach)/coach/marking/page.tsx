import Link from "next/link";
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
  // One row per student (deduplicated across the coach's classes) — marking is
  // per student, so listing them under every class just duplicates rows.
  const students = new Map<string, { id: string; full_name: string; classes: string[] }>();
  const assessed = new Set<string>();
  const markedWeek = new Map<string, number>(); // student_id → this week's avg

  if (classIds.length) {
    const { data: enr } = await supabase
      .from("enrollments")
      .select("student_id, students(id, full_name), classes(id, name)")
      .in("class_id", classIds)
      .eq("active", true);

    const studentIds = new Set<string>();
    for (const e of enr ?? []) {
      const s = (e as any).students;
      const c = (e as any).classes;
      if (!s) continue;
      studentIds.add(s.id);
      const row = students.get(s.id);
      if (row) {
        if (c?.name && !row.classes.includes(c.name)) row.classes.push(c.name);
      } else {
        students.set(s.id, { id: s.id, full_name: s.full_name, classes: c?.name ? [c.name] : [] });
      }
    }

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

  const studentList = [...students.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marking"
        description={`Monthly growth assessment · ${monthLabel(start)}. The "wk" number is this week's average of the 1–5 marks you give on Check-in.`}
      />

      {studentList.length === 0 ? (
        <EmptyState message="No students assigned to your classes yet." />
      ) : (
        <Section title={`Your students (${studentList.length})`} flush>
          <ul className="divide-y divide-slate-100">
            {studentList.map((s) => {
              const done = assessed.has(s.id);
              const wk = markedWeek.get(s.id);
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                    {initials(s.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/coach/marking/${s.id}`} className="block truncate font-medium text-slate-900 hover:text-green-700 hover:underline">{s.full_name}</Link>
                    {s.classes.length > 0 && (
                      <div className="truncate text-xs text-slate-400" title={s.classes.join(", ")}>{s.classes.join(" · ")}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {wk != null && <span className="text-xs font-medium text-blue-600">wk {wk}</span>}
                    {done ? <Badge tone="green">✓</Badge> : <Badge tone="slate">—</Badge>}
                    <LinkButton href={`/coach/marking/${s.id}`} variant="secondary" className="!px-3 !py-1.5 text-xs">
                      {done ? "Re-mark" : "Mark"}
                    </LinkButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
