import { createClient } from "@/lib/supabase/server";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import { LiveCheckIn } from "@/components/live-checkin";
import { formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LiveCheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: qSession } = await searchParams;
  const supabase = await createClient();
  const todayMyt = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

  const { data: todays } = await supabase
    .from("sessions")
    .select("id, start_time, end_time, location, class_id, classes(name)")
    .eq("session_date", todayMyt)
    .order("start_time");

  const sessionOpts = (todays ?? []).map((s: any) => ({
    id: s.id,
    label: `${s.classes?.name ?? "Class"} · ${formatTime(s.start_time)}`,
  }));
  const selectedId = qSession ?? sessionOpts[0]?.id ?? null;

  let session: { id: string; className: string; time: string; location: string | null } | null = null;
  let roster: { id: string; full_name: string }[] = [];
  let initial: any[] = [];

  if (selectedId) {
    const { data: s } = await supabase
      .from("sessions")
      .select("id, start_time, end_time, location, class_id, classes(name)")
      .eq("id", selectedId)
      .maybeSingle();
    if (s) {
      session = {
        id: s.id,
        className: (s as any).classes?.name ?? "Class",
        time: `${formatTime(s.start_time)}–${formatTime(s.end_time)}`,
        location: s.location,
      };
      const [{ data: enr }, { data: att }] = await Promise.all([
        supabase.from("enrollments").select("students(id, full_name)").eq("class_id", s.class_id).eq("active", true),
        supabase.from("attendance").select("student_id, status, tap_in_at, tap_out_at").eq("session_id", selectedId),
      ]);
      roster = (enr ?? [])
        .map((e: any) => e.students)
        .filter(Boolean)
        .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
      initial = att ?? [];
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live check-in"
        description="Students tap their NFC card — no screen needed. The board updates as they tap."
        action={<LinkButton href="/admin/attendance" variant="ghost">← Sessions</LinkButton>}
      />
      {sessionOpts.length === 0 ? (
        <EmptyState message="No sessions scheduled today. Create one from a class first." />
      ) : (
        <LiveCheckIn
          key={selectedId}
          sessions={sessionOpts}
          selectedId={selectedId}
          session={session}
          roster={roster}
          initial={initial}
        />
      )}
    </div>
  );
}
