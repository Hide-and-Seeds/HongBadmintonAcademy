import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { listBranches, canChooseBranch } from "@/lib/branch";
import {
  PageHeader, Collapsible, Field, Input, Select, Button, Badge,
  Table, Th, Td, EmptyState, LinkButton,
} from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { BulkProvider, BulkSelectAll, BulkCheckbox, BulkBar } from "@/components/bulk-select";
import { formatDate, formatTime, DAY_NAMES } from "@/lib/format";
import { dict } from "@/lib/i18n";
import { ClassForm } from "../class-form";
import {
  updateClass, addSchedule, deleteSchedule, addCoaches, removeCoach,
  enrollStudents, unenrollStudent, generateSessions,
  cancelSession, restoreSession, deleteSession, deleteSessions,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ManageClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const DAY_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const dn = (i: number) => (me.locale === "zh" ? DAY_ZH[i] ?? DAY_NAMES[i] : DAY_NAMES[i]);
  const stLabel: Record<string, string> = {
    scheduled: L.st_scheduled, completed: L.st_completed, canceled: L.canceled, in_progress: L.coach_in_progress,
  };
  const supabase = await createClient();
  const branches = await listBranches();
  const today = new Date().toLocaleDateString("en-CA");

  const [
    { data: classRow },
    { data: coaches },
    { data: schedules },
    { data: assigned },
    { data: enrollments },
    { data: students },
    { count: sessionCount },
    { data: upcoming },
  ] = await Promise.all([
    supabase.from("classes").select("*").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("id, full_name").eq("role", "coach").order("full_name"),
    supabase.from("class_schedules").select("*").eq("class_id", id).order("day_of_week"),
    supabase.from("class_coaches").select("coach_id, profiles(full_name)").eq("class_id", id),
    supabase.from("enrollments").select("id, student_id, students(full_name)").eq("class_id", id),
    supabase.from("students").select("id, full_name").eq("status", "active").order("full_name"),
    supabase.from("sessions").select("*", { count: "exact", head: true }).eq("class_id", id),
    supabase
      .from("sessions")
      .select("id, session_date, start_time, end_time, location, status")
      .eq("class_id", id)
      .gte("session_date", today)
      .order("session_date")
      .order("start_time")
      .limit(50),
  ]);

  if (!classRow) notFound();

  const assignedIds = new Set((assigned ?? []).map((a: any) => a.coach_id));
  const enrolledIds = new Set((enrollments ?? []).map((e: any) => e.student_id));
  const availableCoaches = (coaches ?? []).filter((c) => !assignedIds.has(c.id));
  const availableStudents = (students ?? []).filter((s) => !enrolledIds.has(s.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={L.cm_title}
        description={classRow.name}
        action={<LinkButton href="/admin/classes" variant="ghost">{L.cm_all}</LinkButton>}
      />
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <ClassForm
        action={updateClass}
        classRow={classRow}
        coaches={coaches ?? []}
        branches={branches}
        canChooseBranch={canChooseBranch(me)}
        defaultBranchId={me.branch_id}
        locale={me.locale}
      />

      {/* Schedule */}
      <Collapsible title={L.cm_schedule} count={schedules?.length ?? 0}>
        {schedules && schedules.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>{L.cm_day}</Th><Th>{L.col_time}</Th><Th>{L.cm_location}</Th><Th>{L.cm_grace}</Th><Th className="text-right">—</Th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{dn(s.day_of_week)}</Td>
                  <Td>{formatTime(s.start_time)}–{formatTime(s.end_time)}</Td>
                  <Td className="text-slate-500">{s.location ?? "—"}</Td>
                  <Td className="text-slate-500">{s.grace_minutes} {L.cm_min}</Td>
                  <Td className="text-right">
                    <form action={deleteSchedule}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="class_id" value={classRow.id} />
                      <ConfirmButton label={L.hol_remove} confirmText={L.cm_remove_sched} />
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="px-5 pt-5"><EmptyState message={L.cm_no_schedule} /></div>
        )}
        <form action={addSchedule} className="grid items-end gap-4 border-t border-slate-100 p-5 sm:grid-cols-5">
          <input type="hidden" name="class_id" value={classRow.id} />
          <Field label={L.cm_day}>
            <Select name="day_of_week" defaultValue="1">
              {DAY_NAMES.map((d, i) => (
                <option key={i} value={i}>{dn(i)}</option>
              ))}
            </Select>
          </Field>
          <Field label={L.cm_start}><Input type="time" name="start_time" defaultValue="18:00" required /></Field>
          <Field label={L.cm_end}><Input type="time" name="end_time" defaultValue="19:30" required /></Field>
          <Field label={L.cm_grace_min}><Input type="number" name="grace_minutes" defaultValue={15} /></Field>
          <Button type="submit">{L.cm_add_slot}</Button>
        </form>
      </Collapsible>

      {/* Coaches */}
      <Collapsible title={L.cm_coaches} count={(assigned ?? []).length} defaultOpen={false}>
        <div className="p-5">
        <div className="flex flex-wrap gap-2">
          {(assigned ?? []).map((a: any) => (
            <form key={a.coach_id} action={removeCoach}>
              <input type="hidden" name="class_id" value={classRow.id} />
              <input type="hidden" name="coach_id" value={a.coach_id} />
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {a.profiles?.full_name ?? a.coach_id}
                <button className="text-red-500 hover:text-red-700" title={L.hol_remove}>✕</button>
              </span>
            </form>
          ))}
          {(assigned ?? []).length === 0 && (
            <span className="text-sm text-slate-400">{L.cm_no_coaches}</span>
          )}
        </div>
        {availableCoaches.length > 0 ? (
          <form action={addCoaches} className="mt-4 border-t border-slate-100 pt-4">
            <input type="hidden" name="class_id" value={classRow.id} />
            <div className="mb-2 text-sm font-medium text-slate-700">{L.cm_add_coaches}</div>
            <div className="flex flex-wrap gap-2">
              {availableCoaches.map((c) => (
                <label key={c.id} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" name="coach_ids" value={c.id} className="h-4 w-4 accent-green-600" />
                  {c.full_name ?? c.id}
                </label>
              ))}
            </div>
            <div className="mt-3"><Button type="submit">{L.cm_add_selected}</Button></div>
          </form>
        ) : (
          <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-400">{L.cm_all_coaches}</p>
        )}
        </div>
      </Collapsible>

      {/* Enrollment */}
      <Collapsible title={L.cm_enrolled} count={(enrollments ?? []).length} defaultOpen={false}>
        {enrollments && enrollments.length > 0 ? (
          <Table>
            <thead><tr><Th>{L.student_col}</Th><Th className="text-right">—</Th></tr></thead>
            <tbody>
              {enrollments.map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <Td className="font-medium">
                    <Link href={`/admin/students/${e.student_id}`} className="text-slate-900 hover:text-green-700 hover:underline">{e.students?.full_name ?? e.student_id}</Link>
                  </Td>
                  <Td className="text-right">
                    <form action={unenrollStudent}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="class_id" value={classRow.id} />
                      <ConfirmButton label={L.cm_unenroll} confirmText={L.cm_unenroll_confirm} />
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="px-5 pt-5"><EmptyState message={L.cm_no_enrolled} /></div>
        )}
        {availableStudents.length > 0 ? (
          <form action={enrollStudents} className="border-t border-slate-100 p-5">
            <input type="hidden" name="class_id" value={classRow.id} />
            <div className="mb-2 text-sm font-medium text-slate-700">
              {L.cm_enroll_students.replace("{n}", String(availableStudents.length))}
            </div>
            <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
              {availableStudents.map((s) => (
                <label key={s.id} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" name="student_ids" value={s.id} className="h-4 w-4 accent-green-600" />
                  {s.full_name}
                </label>
              ))}
            </div>
            <div className="mt-3"><Button type="submit">{L.cm_enroll_selected}</Button></div>
          </form>
        ) : (
          <p className="border-t border-slate-100 p-5 text-sm text-slate-400">{L.cm_all_enrolled}</p>
        )}
      </Collapsible>

      {/* Sessions */}
      <Collapsible title={L.cm_upcoming} count={sessionCount ?? 0} defaultOpen={false}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div className="text-sm text-slate-600">
            <span className="text-2xl font-bold text-slate-900">{sessionCount ?? 0}</span> {L.cm_total_scheduled}
          </div>
          <form action={generateSessions}>
            <input type="hidden" name="class_id" value={classRow.id} />
            <Button type="submit" variant="secondary">{L.cm_gen_4w}</Button>
          </form>
        </div>
        {upcoming && upcoming.length > 0 ? (
          <BulkProvider>
          <Table>
            <thead>
              <tr>
                <Th className="w-10"><BulkSelectAll /></Th>
                <Th>{L.col_date}</Th><Th>{L.col_time}</Th><Th>{L.cm_location}</Th><Th>{L.col_status}</Th><Th className="text-right">{L.col_actions}</Th>
              </tr>
            </thead>
            <tbody>
              {(upcoming as any[]).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td><BulkCheckbox id={s.id} /></Td>
                  <Td className="font-medium text-slate-900">{formatDate(s.session_date)}</Td>
                  <Td>{formatTime(s.start_time)}–{formatTime(s.end_time)}</Td>
                  <Td className="text-slate-500">{s.location ?? "—"}</Td>
                  <Td>
                    <Badge tone={s.status === "canceled" ? "red" : s.status === "completed" ? "green" : "blue"}>
                      {stLabel[s.status] ?? s.status}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      {s.status === "canceled" ? (
                        <form action={restoreSession}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="class_id" value={classRow.id} />
                          <Button type="submit" variant="secondary">{L.cm_restore}</Button>
                        </form>
                      ) : (
                        <form action={cancelSession}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="class_id" value={classRow.id} />
                          <Button type="submit" variant="secondary">{L.inv_cancel_label}</Button>
                        </form>
                      )}
                      <form action={deleteSession}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="class_id" value={classRow.id} />
                        <ConfirmButton label={L.del_word} confirmText={L.cm_del_session} />
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="px-5 pb-5">
            <BulkBar
              action={deleteSessions}
              label={L.cm_session_word}
              hidden={[{ name: "class_id", value: classRow.id }]}
              confirmText={L.cm_bulk_del_sessions}
              locale={me.locale}
            />
          </div>
          </BulkProvider>
        ) : (
          <div className="px-5 pt-5">
            <EmptyState message={L.cm_no_upcoming} />
          </div>
        )}
      </Collapsible>
    </div>
  );
}
