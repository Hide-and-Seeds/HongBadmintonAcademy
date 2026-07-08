import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  PageHeader, Section, Badge, Table, Th, Td, Button, LinkButton, EmptyState, cn,
} from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { formatDate, formatTime } from "@/lib/format";
import { rankBadgeClass } from "@/lib/ranks";
import { dict } from "@/lib/i18n";
import type { AttendanceStatus } from "@/lib/types";
import { cancelSession, restoreSession, removeSession } from "../actions";

export const dynamic = "force-dynamic";

const ATT_TONE: Record<string, "green" | "yellow" | "red" | "slate"> = {
  present: "green", late: "yellow", absent: "red", excused: "slate",
};

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const attLabel: Record<string, string> = {
    present: L.att_present, late: L.att_late, absent: L.att_absent, excused: L.att_excused,
  };
  const stLabel: Record<string, string> = {
    scheduled: L.st_scheduled, completed: L.st_completed, canceled: L.canceled, in_progress: L.coach_in_progress,
  };
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, class_id, session_date, start_time, end_time, location, status, grace_minutes, classes(name, level, coach:profiles!classes_coach_id_fkey(full_name))")
    .eq("id", id)
    .maybeSingle();

  if (!session) notFound();
  const s = session as any;
  const cls = s.classes;

  const [{ data: enrollments }, { data: attendance }] = await Promise.all([
    supabase.from("enrollments").select("student_id, students(full_name)").eq("class_id", s.class_id).eq("active", true),
    supabase.from("attendance").select("student_id, status").eq("session_id", id),
  ]);

  const statusByStudent = new Map<string, string>();
  for (const a of (attendance ?? []) as any[]) statusByStudent.set(a.student_id, a.status);

  const roster = (enrollments ?? []) as any[];
  const canceled = s.status === "canceled";

  return (
    <div className="space-y-6">
      <PageHeader
        title={cls?.name ?? L.session_word}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {cls?.level && (
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", rankBadgeClass(cls.level))}>{cls.level}</span>
            )}
            <span>{formatDate(s.session_date)} · {formatTime(s.start_time)}–{formatTime(s.end_time)}</span>
            <span>· 📍 {s.location ?? "—"}</span>
            <span>· 🎯 {cls?.coach?.full_name ?? L.sess_no_coach}</span>
            <Badge tone={canceled ? "red" : s.status === "completed" ? "green" : "blue"}>{stLabel[s.status] ?? s.status}</Badge>
          </span>
        }
        action={<LinkButton href="/admin/sessions" variant="ghost">{L.sess_back}</LinkButton>}
      />

      <Section title={L.col_actions}>
        <div className="flex flex-wrap gap-2">
          {canceled ? (
            <form action={restoreSession}>
              <input type="hidden" name="id" value={s.id} />
              <Button type="submit" variant="secondary">{L.sess_restore}</Button>
            </form>
          ) : (
            <form action={cancelSession}>
              <input type="hidden" name="id" value={s.id} />
              <Button type="submit" variant="secondary">{L.sess_cancel}</Button>
            </form>
          )}
          <form action={removeSession}>
            <input type="hidden" name="id" value={s.id} />
            <ConfirmButton label={L.sess_delete} confirmText={L.sess_del_confirm} />
          </form>
        </div>
      </Section>

      <Section title={`${L.cm_enrolled} (${roster.length})`} flush>
        {roster.length > 0 ? (
          <Table>
            <thead>
              <tr><Th>{L.student_col}</Th><Th>{L.attendance_this_session}</Th></tr>
            </thead>
            <tbody>
              {roster.map((e) => {
                const st = statusByStudent.get(e.student_id);
                return (
                  <tr key={e.student_id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-900">{e.students?.full_name ?? e.student_id}</Td>
                    <Td>
                      {st ? <Badge tone={ATT_TONE[st as AttendanceStatus] ?? "slate"}>{attLabel[st] ?? st}</Badge> : <span className="text-slate-400">{L.not_marked}</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="px-5 pt-5"><EmptyState message={L.no_enrolled_class} /></div>
        )}
      </Section>
    </div>
  );
}
