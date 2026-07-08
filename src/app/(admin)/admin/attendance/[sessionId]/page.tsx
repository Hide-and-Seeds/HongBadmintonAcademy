import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { PageHeader, Card, Badge, Button, LinkButton, cn } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";
import { dict } from "@/lib/i18n";
import type { AttendanceStatus } from "@/lib/types";
import { simulateTap, setAttendanceStatus, processFlags, clearAttendanceStatus } from "../actions";

export const dynamic = "force-dynamic";

const TONE: Record<AttendanceStatus, "green" | "yellow" | "red" | "slate"> = {
  present: "green", late: "yellow", absent: "red", excused: "slate",
};

// Filled style for the active status button (one per status).
const STATUS_ON: Record<AttendanceStatus, string> = {
  present: "bg-green-600 text-white ring-green-600",
  late: "bg-amber-500 text-white ring-amber-500",
  absent: "bg-red-600 text-white ring-red-600",
  excused: "bg-slate-500 text-white ring-slate-500",
};
const ORDER: AttendanceStatus[] = ["present", "late", "absent", "excused"];

function tapTime(iso?: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-MY", {
    hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur",
  });
}

export default async function RosterPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const attLabel: Record<string, string> = {
    present: L.att_present, late: L.att_late, absent: L.att_absent, excused: L.att_excused,
  };
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*, classes(name)")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) notFound();

  const [{ data: enrollments }, { data: attendance }, { data: coCoaches }, { data: primaryCls }, { data: coachIns }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("student_id, students(id, full_name, nfc_tag_uid)")
      .eq("class_id", session.class_id)
      .eq("active", true),
    supabase.from("attendance").select("*").eq("session_id", sessionId),
    supabase.from("class_coaches").select("coach_id, profiles(full_name)").eq("class_id", session.class_id),
    supabase.from("classes").select("coach_id, coach:profiles!classes_coach_id_fkey(full_name)").eq("id", session.class_id).maybeSingle(),
    supabase.from("coach_checkins").select("coach_id").eq("session_id", sessionId),
  ]);

  // Coach coverage: who is meant to run this class + did they check in?
  const coachMap = new Map<string, string>();
  if ((primaryCls as any)?.coach_id) coachMap.set((primaryCls as any).coach_id, (primaryCls as any).coach?.full_name ?? "Coach");
  for (const cc of (coCoaches ?? []) as any[]) coachMap.set(cc.coach_id, cc.profiles?.full_name ?? "Coach");
  const checkedSet = new Set((coachIns ?? []).map((c: any) => c.coach_id));
  const coachList = [...coachMap.entries()].map(([id, name]) => ({ id, name, in: checkedSet.has(id) }));

  const byStudent = new Map((attendance ?? []).map((a: any) => [a.student_id, a]));
  const roster = (enrollments ?? [])
    .map((e: any) => ({ student: e.students, att: byStudent.get(e.student_id) }))
    .sort((a, b) => (a.student?.full_name ?? "").localeCompare(b.student?.full_name ?? ""));

  const counts = { present: 0, late: 0, absent: 0, excused: 0, none: 0 };
  for (const r of roster) {
    if (!r.att) counts.none++;
    else counts[r.att.status as AttendanceStatus]++;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={(session as any).classes?.name ?? L.session_word}
        description={`${formatDate(session.session_date)} · ${formatTime(session.start_time)}–${formatTime(session.end_time)} · ${session.location ?? "—"}`}
        action={<LinkButton href="/admin/sessions" variant="ghost">{L.sess_back}</LinkButton>}
      />

      {/* Compact tally + finalise — no tall stat cards to scroll past */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
          <span className="text-green-600">{counts.present} {L.att_present}</span>
          <span className="text-amber-600">{counts.late} {L.att_late}</span>
          <span className="text-red-600">{counts.absent} {L.att_absent}</span>
          <span className="text-slate-500">{counts.excused} {L.att_excused}</span>
          {counts.none > 0 && <span className="text-slate-400">{counts.none} {L.att_unmarked}</span>}
        </div>
        <form action={processFlags}>
          <input type="hidden" name="session_id" value={sessionId} />
          <Button type="submit" variant="secondary" className="!px-3 !py-1.5 text-xs" title={L.att_finalise_title}>
            {L.att_finalise}
          </Button>
        </form>
      </Card>

      {/* Coach coverage — did the assigned coach(es) show up + is the roster marked? */}
      {coachList.length > 0 && (
        <Card className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
          <span className="font-medium text-slate-500">{L.att_coach_court}</span>
          {coachList.map((c) => (
            <span key={c.id} className={cn("inline-flex items-center gap-1 font-medium", c.in ? "text-emerald-700" : "text-slate-400")}>
              {c.in ? "✓" : "○"} {c.name}{c.in ? "" : ` ${L.att_not_checked}`}
            </span>
          ))}
        </Card>
      )}

      {/* One tap sets the status. Big targets, no dropdowns. */}
      <div className="space-y-2">
        {roster.map((r) => {
          const cur = r.att?.status as AttendanceStatus | undefined;
          const tIn = tapTime(r.att?.tap_in_at);
          const tOut = tapTime(r.att?.tap_out_at);
          return (
            <div
              key={r.student.id}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex sm:items-center sm:gap-4"
            >
              <div className="min-w-0 sm:flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/students/${r.student.id}`} className="truncate font-medium text-slate-900 hover:text-green-700 hover:underline">{r.student.full_name}</Link>
                  {cur ? (
                    <Badge tone={TONE[cur]}>{attLabel[cur] ?? cur}{r.att.flagged ? " ⚑" : ""}</Badge>
                  ) : (
                    <span className="text-xs text-slate-400">{L.att_unmarked}</span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  {tIn && <span>{L.att_in_prefix}{tIn}{tOut ? ` · ${L.att_out_prefix}${tOut}` : ""}</span>}
                  <form action={simulateTap} className="inline">
                    <input type="hidden" name="session_id" value={sessionId} />
                    <input type="hidden" name="student_id" value={r.student.id} />
                    <button type="submit" className="text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline">
                      {r.att && !r.att.tap_out_at ? L.att_tap_out : L.att_tap_in}
                    </button>
                  </form>
                  {r.att && (
                    <form action={clearAttendanceStatus} className="inline">
                      <input type="hidden" name="session_id" value={sessionId} />
                      <input type="hidden" name="student_id" value={r.student.id} />
                      <button type="submit" className="text-red-500 underline-offset-2 hover:text-red-700 hover:underline">
                        {L.clear_word}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <form
                action={setAttendanceStatus}
                className="mt-2.5 grid grid-cols-4 gap-1.5 sm:mt-0 sm:w-80 sm:flex-shrink-0"
              >
                <input type="hidden" name="session_id" value={sessionId} />
                <input type="hidden" name="student_id" value={r.student.id} />
                {ORDER.map((st) => (
                  <button
                    key={st}
                    type="submit"
                    name="status"
                    value={st}
                    className={cn(
                      "rounded-lg px-1 py-2.5 text-xs font-semibold capitalize ring-1 ring-inset transition-colors",
                      cur === st
                        ? STATUS_ON[st]
                        : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50 active:bg-slate-100",
                    )}
                  >
                    {attLabel[st] ?? st}
                  </button>
                ))}
              </form>
            </div>
          );
        })}
        {roster.length === 0 && (
          <Card className="p-6 text-center text-sm text-slate-500">{L.no_enrolled_class}</Card>
        )}
      </div>
    </div>
  );
}
