import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Badge, EmptyState, LinkButton } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function SessionRow({ s, isToday }: { s: any; isToday?: boolean }) {
  return (
    <Link
      href={`/admin/attendance/${s.id}`}
      className={`flex items-center justify-between gap-3 rounded-xl border bg-white p-3.5 shadow-sm transition-all hover:border-green-300 hover:shadow ${isToday ? "border-green-300 ring-1 ring-green-200" : "border-slate-200"}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{s.classes?.name ?? "Class"}</span>
          {isToday && <Badge tone="green">Today</Badge>}
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500">
          {formatDate(s.session_date)} · {formatTime(s.start_time)}–{formatTime(s.end_time)} · {s.location ?? "—"}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <Badge tone={s.status === "completed" ? "green" : s.status === "canceled" ? "red" : "blue"}>{s.status}</Badge>
        <span aria-hidden className="text-lg leading-none text-slate-300">›</span>
      </div>
    </Link>
  );
}

function Collapsible({
  title, count, open, children,
}: {
  title: string;
  count: number;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-700">
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-slate-400 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4.5 2.5 8 6l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {title}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{count}</span>
      </summary>
      <div className="space-y-2 border-t border-slate-100 p-3">{children}</div>
    </details>
  );
}

export default async function AttendancePage() {
  const supabase = await createClient();
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 7);
  const to = new Date(today);
  to.setDate(today.getDate() + 7);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, session_date, start_time, end_time, status, location, classes(name)")
    .gte("session_date", from.toLocaleDateString("en-CA"))
    .lte("session_date", to.toLocaleDateString("en-CA"))
    .order("session_date")
    .order("start_time");

  const todayStr = today.toLocaleDateString("en-CA");
  const all = (sessions ?? []) as any[];
  const todayList = all.filter((s) => s.session_date === todayStr);
  const upcoming = all.filter((s) => s.session_date > todayStr);
  const past = all.filter((s) => s.session_date < todayStr).reverse(); // most recent first

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Tap a session to open its roster and mark students."
        action={
          <>
            <LinkButton href="/admin/attendance/live">▶ Live check-in</LinkButton>
            <LinkButton href="/admin/attendance/matrix" variant="secondary">▦ Matrix</LinkButton>
            <LinkButton href="/admin/attendance/overview" variant="secondary">▤ Overview</LinkButton>
          </>
        }
      />

      {all.length > 0 ? (
        <div className="space-y-3">
          {todayList.length > 0 && (
            <div>
              <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Today</div>
              <div className="space-y-2">
                {todayList.map((s) => <SessionRow key={s.id} s={s} isToday />)}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <Collapsible title="Upcoming (next 7 days)" count={upcoming.length} open>
              {upcoming.map((s) => <SessionRow key={s.id} s={s} />)}
            </Collapsible>
          )}

          {past.length > 0 && (
            <Collapsible title="Past 7 days" count={past.length}>
              {past.map((s) => <SessionRow key={s.id} s={s} />)}
            </Collapsible>
          )}
        </div>
      ) : (
        <EmptyState message="No sessions in the last/next 7 days. Generate sessions from a class." />
      )}
    </div>
  );
}
