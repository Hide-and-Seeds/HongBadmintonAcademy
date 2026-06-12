import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, Section, Badge, EmptyState } from "@/components/ui";
import { formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  { href: "/admin/attendance", icon: "📋", title: "Take attendance", sub: "Who's in today" },
  { href: "/admin/sessions", icon: "📅", title: "Sessions", sub: "Manage schedule" },
  { href: "/admin/scorecards", icon: "📊", title: "Growth reports", sub: "Generate & send" },
  { href: "/admin/invoices", icon: "💳", title: "Fees & invoices", sub: "Bill & track" },
  { href: "/admin/people", icon: "👥", title: "People", sub: "Students, parents, coaches" },
  { href: "/admin/announce", icon: "📢", title: "Announce", sub: "Post to community" },
];

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

  const [students, coaches, parents, classes, unpaid, queued] = await Promise.all([
    count("students", (q) => q.eq("status", "active")),
    count("profiles", (q) => q.eq("role", "coach")),
    count("profiles", (q) => q.eq("role", "parent")),
    count("classes", (q) => q.eq("is_active", true)),
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
      <PageHeader title="Dashboard" description="What would you like to do?" />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK_ACTIONS.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-green-300 hover:shadow-sm"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-green-50 text-2xl">
              {q.icon}
            </span>
            <div className="min-w-0">
              <div className="font-semibold leading-tight text-slate-900">{q.title}</div>
              <div className="truncate text-xs text-slate-500">{q.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Active students" value={students} tone="green" />
        <StatCard label="Coaches" value={coaches} />
        <StatCard label="Parents" value={parents} />
        <StatCard label="Active classes" value={classes} tone="blue" />
        <StatCard label="Unpaid invoices" value={unpaid} sub="incl. overdue" tone={unpaid ? "red" : "slate"} />
        <StatCard label="Queued messages" value={queued} sub="WhatsApp" tone={queued ? "amber" : "slate"} />
      </div>

      <div className="mt-8">
        <Section title="Today's sessions" flush>
          {todaySessions && todaySessions.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {todaySessions.map((s: any) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <div className="font-medium text-slate-900">{s.classes?.name ?? "Class"}</div>
                    <div className="text-sm text-slate-500">
                      {formatTime(s.start_time)}–{formatTime(s.end_time)} · {s.location ?? "—"}
                    </div>
                  </div>
                  <Badge tone={s.status === "completed" ? "green" : "blue"}>{s.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5"><EmptyState message="No sessions scheduled today." /></div>
          )}
        </Section>
      </div>
    </div>
  );
}
