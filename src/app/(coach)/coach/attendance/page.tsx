import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section, Badge, EmptyState, cn } from "@/components/ui";
import { formatTime, formatDateTime } from "@/lib/format";
import type { AttendanceStatus } from "@/lib/types";
import { coachClassIds } from "../_data";
import { markAttendance, markSessionMark } from "./actions";

export const dynamic = "force-dynamic";

const TONE: Record<AttendanceStatus, "green" | "yellow" | "red" | "slate"> = {
  present: "green", late: "yellow", absent: "red", excused: "slate",
};

const MARKS: { status: AttendanceStatus; label: string; on: string }[] = [
  { status: "present", label: "Present", on: "bg-green-600 text-white" },
  { status: "late", label: "Late", on: "bg-amber-500 text-white" },
  { status: "absent", label: "Absent", on: "bg-red-600 text-white" },
  { status: "excused", label: "Excused", on: "bg-slate-600 text-white" },
];

export default async function CoachAttendancePage() {
  const me = await requireRole("coach");
  const supabase = await createClient();
  const classIds = await coachClassIds(supabase, me.id);
  const today = new Date().toLocaleDateString("en-CA");

  const { data: sessions } = classIds.length
    ? await supabase
        .from("sessions")
        .select("id, class_id, start_time, end_time, location, classes(name)")
        .in("class_id", classIds)
        .eq("session_date", today)
        .order("start_time")
    : { data: [] as any[] };

  const blocks = [];
  for (const s of sessions ?? []) {
    const [{ data: enr }, { data: att }, { data: marks }] = await Promise.all([
      supabase.from("enrollments").select("students(id, full_name)").eq("class_id", s.class_id).eq("active", true),
      supabase.from("attendance").select("student_id, status, tap_in_at").eq("session_id", s.id),
      supabase.from("session_marks").select("student_id, rating").eq("session_id", s.id),
    ]);
    const map = new Map((att ?? []).map((a: any) => [a.student_id, a]));
    const markMap = new Map((marks ?? []).map((m: any) => [m.student_id, m.rating as number]));
    const roster = (enr ?? []).map((e: any) => ({
      student: e.students,
      att: map.get(e.students?.id),
      mark: markMap.get(e.students?.id),
    }));
    const present = roster.filter((r) => r.att && (r.att.status === "present" || r.att.status === "late")).length;
    blocks.push({ session: s, roster, present });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Live tap status for today's sessions." />

      {blocks.length === 0 && <EmptyState message="No sessions scheduled today." />}

      {blocks.map(({ session, roster, present }) => (
        <Section
          key={session.id}
          title={(session as any).classes?.name ?? "Class"}
          description={`${formatTime(session.start_time)}–${formatTime(session.end_time)} · ${session.location ?? "—"}`}
          action={
            <Badge tone={roster.length && present === roster.length ? "green" : "blue"}>
              {present}/{roster.length} present
            </Badge>
          }
          flush
        >
          <ul className="divide-y divide-slate-100">
            {roster.map((r) => {
              const cur = r.att?.status as AttendanceStatus | undefined;
              return (
                <li key={r.student?.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700">{r.student?.full_name}</span>
                    {r.att ? (
                      <Badge tone={TONE[cur ?? "present"]}>{cur}</Badge>
                    ) : (
                      <span className="text-xs text-slate-400">not tapped</span>
                    )}
                    {r.att?.tap_in_at && <span className="text-xs text-slate-400">{formatDateTime(r.att.tap_in_at)}</span>}
                  </div>
                  {r.student?.id && (
                    <div className="flex flex-wrap gap-1">
                      {MARKS.map((m) => (
                        <form key={m.status} action={markAttendance}>
                          <input type="hidden" name="session_id" value={session.id} />
                          <input type="hidden" name="student_id" value={r.student.id} />
                          <input type="hidden" name="status" value={m.status} />
                          <button
                            type="submit"
                            className={cn(
                              "rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                              cur === m.status
                                ? `${m.on} ring-transparent`
                                : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50",
                            )}
                          >
                            {m.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}

                  {/* Per-session performance mark (1–5) — mark now, while fresh. */}
                  {r.student?.id && (
                    <div className="flex w-full items-center gap-1.5 border-t border-dashed border-slate-100 pt-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Perf</span>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <form key={n} action={markSessionMark}>
                          <input type="hidden" name="session_id" value={session.id} />
                          <input type="hidden" name="student_id" value={r.student.id} />
                          <input type="hidden" name="rating" value={n} />
                          <button
                            type="submit"
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ring-1 ring-inset transition-colors",
                              r.mark === n
                                ? "bg-green-600 text-white ring-transparent"
                                : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50",
                            )}
                          >
                            {n}
                          </button>
                        </form>
                      ))}
                      <span className="ml-1 text-xs text-slate-400">
                        {r.mark ? `${r.mark}/5` : "1 = needs work · 5 = excellent"}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
            {roster.length === 0 && <li className="px-5 py-3 text-sm text-slate-400">No students enrolled.</li>}
          </ul>
        </Section>
      ))}
    </div>
  );
}
