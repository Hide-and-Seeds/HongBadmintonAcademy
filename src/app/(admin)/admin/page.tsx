import Link from "next/link";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, Section, Badge, EmptyState } from "@/components/ui";
import { formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

async function count(table: string, filter?: (q: any) => any) {
  const supabase = await createClient();
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA");

  const [students, coaches, activeClasses, totalClasses, unpaid, queued] = await Promise.all([
    count("students", (q) => q.eq("status", "active")),
    count("profiles", (q) => q.eq("role", "coach")),
    count("classes", (q) => q.eq("is_active", true)),
    count("classes"),
    count("invoices", (q) => q.in("status", ["unpaid", "overdue"])),
    count("messages", (q) => q.eq("status", "queued")),
  ]);

  const { data: todaySessions } = await supabase
    .from("sessions")
    .select("id, start_time, end_time, location, status, classes(name)")
    .eq("session_date", today)
    .order("start_time");

  return (
    <div>
      <PageHeader title="Dashboard" description="Today at a glance." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Link href="/admin/people?tab=students" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/40">
          <StatCard label="Active students" value={students} tone="green" />
        </Link>
        <Link href="/admin/coaches/summary" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/40">
          <StatCard label="Coaches & payroll" value={coaches} tone="slate" />
        </Link>
        <Link href="/admin/classes" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/40">
          <StatCard label="Active / total classes" value={`${activeClasses} / ${totalClasses}`} tone="blue" />
        </Link>
        <Link href="/admin/invoices" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/40">
          <StatCard label="Unpaid invoices" value={unpaid} tone={unpaid ? "red" : "slate"} />
        </Link>
        <Link href="/admin/messages" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/40">
          <StatCard label="Queued messages" value={queued} tone={queued ? "amber" : "slate"} />
        </Link>
      </div>

      <div className="mt-8">
        <Section title="Today's sessions" flush>
          {todaySessions && todaySessions.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {todaySessions.map((s: any) => (
                <Link key={s.id} href={`/admin/attendance/${s.id}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50">
                  <div className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-blue-50">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="mt-0.5 text-[11px] font-semibold leading-none text-blue-700">{formatTime(s.start_time)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{s.classes?.name ?? "Class"}</div>
                    <div className="text-sm text-slate-500">{formatTime(s.start_time)}–{formatTime(s.end_time)} · {s.location ?? "—"}</div>
                  </div>
                  <Badge tone={s.status === "completed" ? "green" : "blue"}>{s.status}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-5"><EmptyState message="No sessions scheduled today." /></div>
          )}
        </Section>
      </div>
    </div>
  );
}
