import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  PageHeader, StatCard, Table, Th, Td, Badge, EmptyState, LinkButton,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AttendanceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const ATT_TONE: Record<AttendanceStatus, "green" | "yellow" | "red" | "slate"> = {
  present: "green", late: "yellow", absent: "red", excused: "slate",
};

export default async function ChildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("parent");
  const { id } = await params;
  const supabase = await createClient();

  // RLS ensures a parent can only read their own child.
  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, status")
    .eq("id", id)
    .maybeSingle();
  if (!student) notFound();

  const [{ data: attendance }, { data: assessments }, { data: ledger }] = await Promise.all([
    supabase
      .from("attendance")
      .select("status, tap_in_at, tap_out_at, sessions(session_date, classes(name))")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("assessments")
      .select("assessed_on, overall_score, comment, marking_schemes(name)")
      .eq("student_id", id)
      .order("assessed_on", { ascending: false })
      .limit(20),
    supabase
      .from("reward_ledger")
      .select("points, reason, awarded_at")
      .eq("student_id", id)
      .order("awarded_at", { ascending: false }),
  ]);

  const att = attendance ?? [];
  const total = att.length;
  const attended = att.filter((a: any) => a.status === "present" || a.status === "late").length;
  const rate = total ? Math.round((attended / total) * 100) : null;
  const scores = (assessments ?? []).map((a: any) => Number(a.overall_score)).filter((n) => !Number.isNaN(n));
  const avgScore = scores.length ? (scores.reduce((x, y) => x + y, 0) / scores.length).toFixed(1) : "—";
  const points = (ledger ?? []).reduce((x: number, r: any) => x + Number(r.points), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title={student.full_name}
        description="Attendance and progress"
        action={<LinkButton href="/parent" variant="ghost">← Back</LinkButton>}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Attendance rate" value={rate != null ? `${rate}%` : "—"} sub={`${attended}/${total} sessions`} />
        <StatCard label="Avg skill score" value={avgScore} sub={`${scores.length} assessments`} />
        <StatCard label="Reward points" value={points} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Attendance history</h2>
        {att.length ? (
          <Table>
            <thead><tr><Th>Date</Th><Th>Class</Th><Th>Status</Th><Th>Tap in</Th></tr></thead>
            <tbody>
              {att.map((a: any, i) => (
                <tr key={i}>
                  <Td>{formatDate(a.sessions?.session_date)}</Td>
                  <Td>{a.sessions?.classes?.name ?? "—"}</Td>
                  <Td><Badge tone={ATT_TONE[a.status as AttendanceStatus]}>{a.status}</Badge></Td>
                  <Td>{a.tap_in_at ? formatDateTime(a.tap_in_at) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState message="No attendance records yet." />}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Progress</h2>
        {assessments && assessments.length ? (
          <Table>
            <thead><tr><Th>Date</Th><Th>Scheme</Th><Th>Score</Th><Th>Comment</Th></tr></thead>
            <tbody>
              {assessments.map((a: any, i) => (
                <tr key={i}>
                  <Td>{formatDate(a.assessed_on)}</Td>
                  <Td>{a.marking_schemes?.name ?? "—"}</Td>
                  <Td><Badge tone="blue">{a.overall_score != null ? `${a.overall_score}%` : "—"}</Badge></Td>
                  <Td className="max-w-sm truncate text-slate-500" title={a.comment ?? ""}>{a.comment ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState message="No assessments yet." />}
      </section>

      {ledger && ledger.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Rewards</h2>
          <Table>
            <thead><tr><Th>Date</Th><Th>Reason</Th><Th>Points</Th></tr></thead>
            <tbody>
              {ledger.map((r: any, i) => (
                <tr key={i}>
                  <Td>{formatDate(r.awarded_at)}</Td>
                  <Td>{r.reason ?? "—"}</Td>
                  <Td className="font-medium text-green-700">+{r.points}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}
    </div>
  );
}
