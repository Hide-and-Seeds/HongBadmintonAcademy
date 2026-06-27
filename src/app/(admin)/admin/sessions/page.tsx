import { createClient } from "@/lib/supabase/server";
import { PageHeader, LinkButton } from "@/components/ui";
import { MonthCalendar } from "@/components/month-calendar";
import { AddSessionModal } from "@/components/add-session-modal";
import { FilterSelect } from "@/components/filter-controls";
import { loadHolidayMap } from "@/lib/holidays-server";
import { createSession } from "./actions";

export const dynamic = "force-dynamic";

// Today in Malaysia time, as YYYY-MM-DD.
function todayMYT(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; class?: string; error?: string; created?: string }>;
}) {
  const { month, class: classParam, error, created } = await searchParams;
  const supabase = await createClient();

  // Displayed month (YYYY-MM), defaulting to the current MYT month.
  const monthStr = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : todayMYT().slice(0, 7);
  const [y, m] = monthStr.split("-").map(Number);
  const start = `${monthStr}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  const classFilter = classParam && /^[0-9a-f-]{36}$/i.test(classParam) ? classParam : "";

  let sessQuery = supabase
    .from("sessions")
    .select("id, session_date, start_time, end_time, location, status, class_id, classes(name, level, coach:profiles!classes_coach_id_fkey(full_name))")
    .gte("session_date", start)
    .lte("session_date", end)
    .order("session_date")
    .order("start_time")
    .limit(400);
  if (classFilter) sessQuery = sessQuery.eq("class_id", classFilter);

  const [{ data: sessions }, { data: classes }, holidays] = await Promise.all([
    sessQuery,
    supabase.from("classes").select("id, name").eq("is_active", true).order("name"),
    loadHolidayMap(supabase, start, end),
  ]);

  const list = (sessions ?? []) as any[];

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="Sessions by month — tap a date to see details, cancel or delete."
        action={
          <>
            <AddSessionModal classes={classes ?? []} monthStr={monthStr} today={todayMYT()} />
            <LinkButton href="/admin/classes" variant="secondary">
              Generate (per class) →
            </LinkButton>
          </>
        }
      />

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {created && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Session added.
        </p>
      )}

      {/* Class filter — keep one knob so a single noisy class doesn't drown the
       *  month view. Status filter + bulk-action table were dropped — single
       *  sessions are managed on the session detail page now. */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-600">Class</span>
          <FilterSelect name="class" defaultValue={classFilter} className="h-9 w-48">
            <option value="">All classes</option>
            {(classes ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </FilterSelect>
        </label>
        {classFilter && (
          <LinkButton href={`/admin/sessions?month=${monthStr}`} variant="ghost">Clear</LinkButton>
        )}
      </div>

      <MonthCalendar
        monthStr={monthStr}
        holidays={holidays}
        sessions={list.map((s) => ({
          id: s.id,
          session_date: s.session_date,
          start_time: s.start_time,
          end_time: s.end_time,
          location: s.location,
          status: s.status,
          className: s.classes?.name ?? null,
          classRank: s.classes?.level ?? null,
          coachName: s.classes?.coach?.full_name ?? null,
        }))}
      />
    </div>
  );
}
