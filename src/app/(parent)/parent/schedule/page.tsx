import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section, EmptyState, Badge } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ParentSchedulePage() {
  const me = await requireRole("parent");
  const supabase = await createClient();
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

  // Group sessions under one date heading so the same date isn't repeated row
  // after row — parents scan by day, not by class.
  const byDate = new Map<string, any[]>();
  for (const s of (sessions ?? []) as any[]) {
    const list = byDate.get(s.session_date) ?? [];
    list.push(s);
    byDate.set(s.session_date, list);
  }
  const dates = [...byDate.keys()];

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" description="Upcoming sessions for your children." />

      {dates.length ? (
        <div className="space-y-5">
          {dates.map((date) => (
            <Section key={date} title={formatDate(date)} flush>
              <ul className="divide-y divide-slate-100">
                {byDate.get(date)!.map((s) => {
                  const names = classToChildren.get(s.class_id) ?? [];
                  const clsName = classNames.get(s.class_id) ?? "—";
                  return (
                    <li key={s.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                      <div>
                        <div className="font-semibold text-slate-900">{clsName}</div>
                        <div className="text-sm text-slate-500">
                          {formatTime(s.start_time)}–{formatTime(s.end_time)}
                          {s.location ? ` · ${s.location}` : ""}
                        </div>
                        {names.length > 0 && (
                          <div className="mt-1 text-xs text-slate-400">{names.join(", ")}</div>
                        )}
                      </div>
                      <Badge tone={s.status === "completed" ? "green" : s.status === "cancelled" ? "red" : "blue"}>
                        {s.status}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </Section>
          ))}
        </div>
      ) : (
        <EmptyState message="No upcoming sessions scheduled." />
      )}
    </div>
  );
}
