import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, Card, Table, Th, Td, EmptyState, LinkButton, Badge } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { computeAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

function Bars({ data, tones }: { data: Record<string, number>; tones?: Record<string, string> }) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (entries.length === 0) return <EmptyState message="No data yet." />;
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 capitalize text-slate-600">{k}</span>
          <div className="h-4 flex-1 rounded bg-slate-100">
            <div
              className={`h-4 rounded ${tones?.[k] ?? "bg-green-500"}`}
              style={{ width: `${(v / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right font-medium text-slate-700">{v}</span>
        </div>
      ))}
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const a = await computeAnalytics(supabase);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description={`Academy metrics · revenue for ${a.monthLabel}`}
        action={
          <LinkButton href="/api/analytics/pdf" target="_blank" rel="noopener" variant="secondary">
            Download PDF
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue (this month)" value={formatCurrency(a.revenueThisMonth, a.currency)} />
        <StatCard label="Outstanding fees" value={formatCurrency(a.outstanding, a.currency)} />
        <StatCard label="Attendance rate" value={a.attendanceRate != null ? `${a.attendanceRate}%` : "—"} />
        <StatCard label="Avg skill score" value={a.avgScore != null ? `${a.avgScore}%` : "—"} sub={`${a.assessmentCount} assessments`} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active students" value={a.counts.students} />
        <StatCard label="Coaches" value={a.counts.coaches} />
        <StatCard label="Parents" value={a.counts.parents} />
        <StatCard label="Active classes" value={a.counts.classes} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Attendance breakdown</h2>
          <Bars
            data={a.attendanceBreakdown}
            tones={{ present: "bg-green-500", late: "bg-amber-500", absent: "bg-red-500", excused: "bg-slate-400" }}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Invoices by status</h2>
          <Bars data={a.invoiceStatus} tones={{ paid: "bg-green-500", unpaid: "bg-amber-500", overdue: "bg-red-500" }} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Reward leaderboard</h2>
          {a.topStudents.length ? (
            <Table>
              <thead><tr><Th>#</Th><Th>Student</Th><Th>Points</Th></tr></thead>
              <tbody>
                {a.topStudents.map((s, i) => (
                  <tr key={i}>
                    <Td>{i + 1}</Td>
                    <Td className="font-medium text-slate-900">{s.name}</Td>
                    <Td><Badge tone="green">{s.points}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState message="No rewards awarded yet." />}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">WhatsApp delivery</h2>
          <Bars
            data={a.messageStatus}
            tones={{ delivered: "bg-green-500", read: "bg-green-600", sent: "bg-blue-500", queued: "bg-slate-400", failed: "bg-red-500" }}
          />
        </Card>
      </div>
    </div>
  );
}
