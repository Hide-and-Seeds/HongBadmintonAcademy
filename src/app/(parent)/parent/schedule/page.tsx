import { requireParent } from "@/lib/parent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Section, EmptyState, Badge, Table, Th, Td } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ParentSchedulePage() {
  const me = await requireParent();
  const supabase = createAdminClient();
  const today = new Date().toLocaleDateString("en-CA");

  const { data: children } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("parent_id", me.id)
    .order("full_name");

  const childIds = (children ?? []).map((c) => c.id);

  if (!childIds.length) {
    return (
      <div>
        <PageHeader title="Schedule" description="Upcoming sessions for your children." />
        <EmptyState message="No children linked to your account." />
      </div>
    );
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, class_id, classes(name)")
    .in("student_id", childIds)
    .eq("active", true);

  const classIds = [...new Set(
    (enrollments ?? []).map((e: any) => e.class_id).filter(Boolean),
  )];

  const { data: sessions } = classIds.length
    ? await supabase
        .from("sessions")
        .select("id, session_date, start_time, end_time, location, status, class_id")
        .in("class_id", classIds)
        .gte("session_date", today)
        .order("session_date")
        .order("start_time")
        .limit(30)
    : { data: [] as any[] };

  // class_id → child names
  const classToChildren = new Map<string, string[]>();
  for (const e of (enrollments ?? []) as any[]) {
    if (!e.class_id) continue;
    const existing = classToChildren.get(e.class_id) ?? [];
    const child = (children ?? []).find((c) => c.id === e.student_id);
    if (child) existing.push(child.full_name);
    classToChildren.set(e.class_id, existing);
  }

  // class_id → class name
  const classNames = new Map<string, string>();
  for (const e of (enrollments ?? []) as any[]) {
    if (e.class_id && e.classes?.name) classNames.set(e.class_id, e.classes.name);
  }

  // Upcoming school holidays only (academy closures — no class). Public
  // holidays are deliberately left off the parent schedule.
  const { data: schoolHols } = await supabase
    .from("school_holidays")
    .select("name, start_date, end_date")
    .gte("end_date", today)
    .order("start_date")
    .limit(6);
  const upcomingHols = (schoolHols ?? []).map((h: any) => ({ name: h.name, start: h.start_date, end: h.end_date }));

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" description="Upcoming sessions for your children." />

      {upcomingHols.length > 0 && (
        <Section title="School holidays — no class" flush>
          <ul className="divide-y divide-slate-100">
            {upcomingHols.map((h, i) => (
              <li key={i} className="px-5 py-3">
                <div className="font-medium text-slate-900">{h.name}</div>
                <div className="text-sm text-slate-500">
                  {h.start === h.end ? formatDate(h.start) : `${formatDate(h.start)} – ${formatDate(h.end)}`}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(sessions ?? []).length ? (
        <Section title="Upcoming sessions" flush>
          <Table>
            <thead>
              <tr><Th>Date</Th><Th>Time</Th><Th>Class</Th><Th>Who</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {(sessions ?? []).map((s: any) => {
                const names = classToChildren.get(s.class_id) ?? [];
                const clsName = classNames.get(s.class_id) ?? "—";
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <Td label="Date" className="font-medium text-slate-900">{formatDate(s.session_date)}</Td>
                    <Td label="Time">{formatTime(s.start_time)}–{formatTime(s.end_time)}{s.location ? ` · ${s.location}` : ""}</Td>
                    <Td label="Class" className="text-slate-700">{clsName}</Td>
                    <Td label="Who" className="text-slate-500">{names.join(", ") || "—"}</Td>
                    <Td label="Status">
                      <Badge tone={s.status === "completed" ? "green" : s.status === "canceled" ? "red" : "blue"}>
                        {s.status}
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Section>
      ) : (
        <EmptyState message="No upcoming sessions scheduled." />
      )}
    </div>
  );
}
