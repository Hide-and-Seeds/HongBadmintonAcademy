import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PageHeader, Card, StatCard, Table, Th, Td, Badge, EmptyState,
  LinkButton, Field, Input, Select, Button,
} from "@/components/ui";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/format";
import type { AttendanceStatus, InvoiceStatus } from "@/lib/types";
import { awardReward } from "../actions";

export const dynamic = "force-dynamic";

const ATT_TONE: Record<AttendanceStatus, "green" | "yellow" | "red" | "slate"> = {
  present: "green", late: "yellow", absent: "red", excused: "slate",
};
const INV_TONE: Record<InvoiceStatus, "green" | "yellow" | "red" | "slate"> = {
  draft: "slate", unpaid: "yellow", paid: "green", overdue: "red", canceled: "slate", refunded: "slate",
};

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("*, parent:profiles!students_parent_id_fkey(full_name, phone)")
    .eq("id", id)
    .maybeSingle();
  if (!student) notFound();

  const [
    { data: attendance },
    { data: assessments },
    { data: ledger },
    { data: rules },
    { data: invoices },
    { data: enrollments },
  ] = await Promise.all([
    supabase
      .from("attendance")
      .select("status, tap_in_at, tap_out_at, sessions(session_date, classes(name))")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("assessments")
      .select("assessed_on, overall_score, marking_schemes(name), coach:profiles!assessments_coach_id_fkey(full_name)")
      .eq("student_id", id)
      .order("assessed_on", { ascending: false })
      .limit(20),
    supabase
      .from("reward_ledger")
      .select("points, reason, awarded_at, reward_rules(name)")
      .eq("student_id", id)
      .order("awarded_at", { ascending: false }),
    supabase.from("reward_rules").select("id, name, points").eq("is_active", true).order("name"),
    supabase
      .from("invoices")
      .select("invoice_no, amount, currency, status, due_date")
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("enrollments").select("classes(name)").eq("student_id", id).eq("active", true),
  ]);

  const att = attendance ?? [];
  const total = att.length;
  const attended = att.filter((a: any) => a.status === "present" || a.status === "late").length;
  const rate = total ? Math.round((attended / total) * 100) : null;

  const scores = (assessments ?? [])
    .map((a: any) => Number(a.overall_score))
    .filter((n) => !Number.isNaN(n));
  const avgScore = scores.length ? (scores.reduce((x, y) => x + y, 0) / scores.length).toFixed(1) : "—";

  const totalPoints = (ledger ?? []).reduce((x: number, r: any) => x + Number(r.points), 0);
  const classNames = (enrollments ?? []).map((e: any) => e.classes?.name).filter(Boolean).join(", ");

  return (
    <div className="space-y-8">
      <PageHeader
        title={student.full_name}
        description={[
          student.status,
          student.parent?.full_name ? `Parent: ${student.parent.full_name}` : null,
          classNames || null,
        ].filter(Boolean).join(" · ")}
        action={
          <div className="flex gap-2">
            <LinkButton href={`/admin/students/${id}/edit`} variant="secondary">Edit</LinkButton>
            <LinkButton href="/admin/students" variant="ghost">← All students</LinkButton>
          </div>
        }
      />
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Attendance rate" value={rate != null ? `${rate}%` : "—"} sub={`${attended}/${total} sessions`} />
        <StatCard label="Avg skill score" value={avgScore} sub={`${scores.length} assessments`} />
        <StatCard label="Reward points" value={totalPoints} />
        <StatCard label="NFC tag" value={student.nfc_tag_uid ? "✓" : "—"} sub={student.nfc_tag_uid ?? "unbound"} />
      </div>

      {/* Attendance history */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Attendance history</h2>
        {att.length ? (
          <Table>
            <thead><tr><Th>Date</Th><Th>Class</Th><Th>Status</Th><Th>Tap in</Th><Th>Tap out</Th></tr></thead>
            <tbody>
              {att.map((a: any, i) => (
                <tr key={i}>
                  <Td>{formatDate(a.sessions?.session_date)}</Td>
                  <Td>{a.sessions?.classes?.name ?? "—"}</Td>
                  <Td><Badge tone={ATT_TONE[a.status as AttendanceStatus]}>{a.status}</Badge></Td>
                  <Td>{a.tap_in_at ? formatDateTime(a.tap_in_at) : "—"}</Td>
                  <Td>{a.tap_out_at ? formatDateTime(a.tap_out_at) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState message="No attendance records yet." />}
      </section>

      {/* Progress */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Progress (assessments)</h2>
        {assessments && assessments.length ? (
          <Table>
            <thead><tr><Th>Date</Th><Th>Scheme</Th><Th>Coach</Th><Th>Overall</Th></tr></thead>
            <tbody>
              {assessments.map((a: any, i) => (
                <tr key={i}>
                  <Td>{formatDate(a.assessed_on)}</Td>
                  <Td>{a.marking_schemes?.name ?? "—"}</Td>
                  <Td>{a.coach?.full_name ?? "—"}</Td>
                  <Td><Badge tone="blue">{a.overall_score != null ? `${a.overall_score}%` : "—"}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState message="No assessments yet." />}
      </section>

      {/* Rewards */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Rewards</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {ledger && ledger.length ? (
              <Table>
                <thead><tr><Th>Date</Th><Th>Rule</Th><Th>Reason</Th><Th>Points</Th></tr></thead>
                <tbody>
                  {ledger.map((r: any, i) => (
                    <tr key={i}>
                      <Td>{formatDate(r.awarded_at)}</Td>
                      <Td>{r.reward_rules?.name ?? "—"}</Td>
                      <Td>{r.reason ?? "—"}</Td>
                      <Td className="font-medium text-green-700">+{r.points}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <EmptyState message="No rewards awarded yet." />}
          </div>
          <Card className="p-5">
            <h3 className="mb-3 font-medium text-slate-800">Award points</h3>
            <form action={awardReward} className="space-y-3">
              <input type="hidden" name="student_id" value={id} />
              <Field label="Rule (optional)">
                <Select name="rule_id" defaultValue="">
                  <option value="">— custom —</option>
                  {(rules ?? []).map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name} (+{r.points})</option>
                  ))}
                </Select>
              </Field>
              <Field label="Points">
                <Input type="number" name="points" defaultValue={10} required />
              </Field>
              <Field label="Reason">
                <Input name="reason" placeholder="e.g. Perfect attendance" />
              </Field>
              <Button type="submit" className="w-full">Award</Button>
            </form>
          </Card>
        </div>
      </section>

      {/* Invoices */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Fees</h2>
        {invoices && invoices.length ? (
          <Table>
            <thead><tr><Th>Invoice</Th><Th>Amount</Th><Th>Due</Th><Th>Status</Th></tr></thead>
            <tbody>
              {invoices.map((inv: any, i) => (
                <tr key={i}>
                  <Td className="font-mono text-xs">{inv.invoice_no ?? "—"}</Td>
                  <Td>{formatCurrency(Number(inv.amount), inv.currency)}</Td>
                  <Td>{formatDate(inv.due_date)}</Td>
                  <Td><Badge tone={INV_TONE[inv.status as InvoiceStatus]}>{inv.status}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState message="No invoices yet." />}
      </section>
    </div>
  );
}
