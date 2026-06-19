import { requireParent } from "@/lib/parent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Section, EmptyState, Badge } from "@/components/ui";
import { Clock, MapPin, User, Users } from "lucide-react";
import { formatDate, formatTime } from "@/lib/format";
import { ParentSessionList, type PastSession } from "@/components/parent-session-list";

export const dynamic = "force-dynamic";

export default async function ParentSchedulePage() {
  const me = await requireParent();
  const supabase = createAdminClient();
  const today = new Date().toLocaleDateString("en-CA");
  const since = new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA");

  const { data: children } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("parent_id", me.id)
    .order("full_name");

  const childIds = (children ?? []).map((c) => c.id);

  if (!childIds.length) {
    return (
      <div>
        <PageHeader title="Schedule" />
        <EmptyState message="No children linked to your account." />
      </div>
    );
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, class_id, classes(name)")
    .in("student_id", childIds)
    .eq("active", true);

  const classIds = [...new Set((enrollments ?? []).map((e: any) => e.class_id).filter(Boolean))];

  // Sessions window: recent past (30 days) + all upcoming, split below.
  const { data: sessions } = classIds.length
    ? await supabase
        .from("sessions")
        .select("id, session_date, start_time, end_time, location, status, class_id")
        .in("class_id", classIds)
        .gte("session_date", since)
        .order("session_date")
        .order("start_time")
        .limit(60)
    : { data: [] as any[] };

  const all = (sessions ?? []) as any[];
  const upcoming = all.filter((s) => s.session_date >= today);
  const past = all.filter((s) => s.session_date < today).reverse().slice(0, 10); // newest first

  // class_id → class name, parent's kids in it (id + name)
  const classNames = new Map<string, string>();
  const classKids = new Map<string, { id: string; name: string }[]>();
  for (const e of (enrollments ?? []) as any[]) {
    if (!e.class_id) continue;
    if (e.classes?.name) classNames.set(e.class_id, e.classes.name);
    const child = (children ?? []).find((c) => c.id === e.student_id);
    if (child) {
      const arr = classKids.get(e.class_id) ?? [];
      arr.push({ id: child.id, name: child.full_name });
      classKids.set(e.class_id, arr);
    }
  }
  const namesFor = (classId: string) => (classKids.get(classId) ?? []).map((k) => k.name);

  // class_id → coach name (primary class coach, else first assigned).
  const [{ data: cls }, { data: ccs }] = await Promise.all([
    supabase.from("classes").select("id, coach_id").in("id", classIds),
    supabase.from("class_coaches").select("class_id, coach_id").in("class_id", classIds),
  ]);
  const coachIdSet = new Set<string>();
  for (const c of (cls ?? []) as any[]) if (c.coach_id) coachIdSet.add(c.coach_id);
  for (const c of (ccs ?? []) as any[]) if (c.coach_id) coachIdSet.add(c.coach_id);
  const { data: coachProfiles } = coachIdSet.size
    ? await supabase.from("profiles").select("id, full_name").in("id", [...coachIdSet])
    : { data: [] as any[] };
  const coachName = new Map((coachProfiles ?? []).map((p: any) => [p.id, p.full_name as string]));
  const classCoach = new Map<string, string>();
  for (const c of (cls ?? []) as any[]) if (c.coach_id) classCoach.set(c.id, coachName.get(c.coach_id) ?? "");
  for (const c of (ccs ?? []) as any[]) if (!classCoach.has(c.class_id) && c.coach_id) classCoach.set(c.class_id, coachName.get(c.coach_id) ?? "");

  // Past attendance + session marks for this parent's children.
  const pastIds = past.map((s) => s.id);
  const [{ data: att }, { data: marks }] = pastIds.length
    ? await Promise.all([
        supabase.from("attendance").select("session_id, student_id, status, tap_in_at").in("session_id", pastIds).in("student_id", childIds),
        supabase.from("session_marks").select("session_id, student_id, rating").in("session_id", pastIds).in("student_id", childIds),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];
  const attBy = new Map<string, any>();
  for (const a of (att ?? []) as any[]) attBy.set(`${a.session_id}:${a.student_id}`, a);
  const markBy = new Map<string, number>();
  for (const m of (marks ?? []) as any[]) markBy.set(`${m.session_id}:${m.student_id}`, Number(m.rating));

  const pastItems: PastSession[] = past.map((s) => {
    const d = new Date(`${s.session_date}T00:00:00`);
    const kids = (classKids.get(s.class_id) ?? []).map((k) => {
      const a = attBy.get(`${s.id}:${k.id}`);
      return {
        name: k.name,
        status: a?.status ?? null,
        tapIn: a?.tap_in_at ? new Date(a.tap_in_at).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" }) : null,
        rating: markBy.has(`${s.id}:${k.id}`) ? markBy.get(`${s.id}:${k.id}`)! : null,
      };
    });
    return {
      id: s.id,
      mon: d.toLocaleDateString("en-MY", { month: "short" }),
      day: d.getDate(),
      wd: d.toLocaleDateString("en-MY", { weekday: "short" }),
      timeLabel: `${formatTime(s.start_time)}–${formatTime(s.end_time)}`,
      location: s.location,
      className: classNames.get(s.class_id) ?? "—",
      coach: classCoach.get(s.class_id) || null,
      kids,
    };
  });

  // School closures (no public holidays — owner announces those separately).
  const { data: schoolHols } = await supabase
    .from("school_holidays")
    .select("name, start_date, end_date")
    .gte("end_date", today)
    .order("start_date")
    .limit(6);
  const upcomingHols = (schoolHols ?? []).map((h: any) => ({ name: h.name, start: h.start_date, end: h.end_date }));

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" />

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

      {upcoming.length ? (
        <Section title="Upcoming sessions" flush>
          <ul className="divide-y divide-slate-100">
            {upcoming.map((s) => {
              const names = namesFor(s.class_id);
              const coach = classCoach.get(s.class_id);
              const d = new Date(`${s.session_date}T00:00:00`);
              const mon = d.toLocaleDateString("en-MY", { month: "short" });
              const wd = d.toLocaleDateString("en-MY", { weekday: "short" });
              return (
                <li key={s.id} className="flex items-center gap-3.5 px-4 py-3.5">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-50">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">{mon}</span>
                    <span className="text-xl font-bold leading-none text-emerald-800">{d.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{classNames.get(s.class_id) ?? "—"}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{wd} {formatTime(s.start_time)}–{formatTime(s.end_time)}</span>
                      {s.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.location}</span>}
                      {coach && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />Coach {coach}</span>}
                      {childIds.length > 1 && names.length > 0 && (
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{names.join(", ")}</span>
                      )}
                    </div>
                  </div>
                  {s.status !== "scheduled" && (
                    <Badge tone={s.status === "completed" ? "green" : s.status === "canceled" ? "red" : "blue"}>{s.status}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : (
        <EmptyState message="No upcoming sessions scheduled." />
      )}

      {pastItems.length > 0 && (
        <Section title="Recent sessions" description="Tap a session to see attendance & coach marks" flush>
          <ParentSessionList sessions={pastItems} />
        </Section>
      )}
    </div>
  );
}
