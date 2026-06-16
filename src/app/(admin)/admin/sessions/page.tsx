import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  PageHeader, Section, Field, Input, Select, Table, Th, Td, Badge, EmptyState, LinkButton, Button,
} from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { BulkProvider, BulkSelectAll, BulkCheckbox, BulkBar } from "@/components/bulk-select";
import { MonthCalendar } from "@/components/month-calendar";
import { formatDate, formatTime } from "@/lib/format";
import { createSession, cancelSession, restoreSession, deleteSession, deleteSessions } from "./actions";

export const dynamic = "force-dynamic";

// Today in Malaysia time, as YYYY-MM-DD.
function todayMYT(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string; created?: string }>;
}) {
  const { month, error, created } = await searchParams;
  const supabase = await createClient();

  // Displayed month (YYYY-MM), defaulting to the current MYT month.
  const monthStr = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : todayMYT().slice(0, 7);
  const [y, m] = monthStr.split("-").map(Number);
  const start = `${monthStr}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  const [{ data: sessions }, { data: classes }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, session_date, start_time, end_time, location, status, classes(name)")
      .gte("session_date", start)
      .lte("session_date", end)
      .order("session_date")
      .order("start_time")
      .limit(400),
    supabase.from("classes").select("id, name").eq("is_active", true).order("name"),
  ]);

  const list = (sessions ?? []) as any[];

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="Browse sessions month by month. Tap a session to take/see attendance. Add a one-off below, or generate a class's whole schedule."
        action={
          <LinkButton href="/admin/classes" variant="secondary">
            Generate (per class) →
          </LinkButton>
        }
      />

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {created && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Session added.
        </p>
      )}

      {/* Add a single session — the friendly path (no weekly schedule needed). */}
      <Section title="Add a session" description="A one-off or makeup class on a specific date." className="mb-6">
        {classes && classes.length > 0 ? (
          <form action={createSession} className="grid items-end gap-4 sm:grid-cols-6">
            <input type="hidden" name="month" value={monthStr} />
            <div className="sm:col-span-2">
              <Field label="Class" required>
                <Select name="class_id" required defaultValue="">
                  <option value="" disabled>— pick a class —</option>
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Date" required>
              <Input type="date" name="session_date" required defaultValue={todayMYT()} />
            </Field>
            <Field label="Start" required>
              <Input type="time" name="start_time" required defaultValue="18:00" />
            </Field>
            <Field label="End" required>
              <Input type="time" name="end_time" required defaultValue="19:30" />
            </Field>
            <Button type="submit">+ Add</Button>
            <div className="sm:col-span-6">
              <Field label="Location (optional)">
                <Input name="location" placeholder="e.g. Court 1" className="sm:max-w-xs" />
              </Field>
            </div>
          </form>
        ) : (
          <EmptyState message="No active classes yet — create a class first." />
        )}
      </Section>

      <div className="space-y-6">
        <MonthCalendar
          monthStr={monthStr}
          sessions={list.map((s) => ({
            id: s.id,
            session_date: s.session_date,
            start_time: s.start_time,
            end_time: s.end_time,
            location: s.location,
            status: s.status,
            className: s.classes?.name ?? null,
          }))}
        />

        {list.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-medium text-slate-600 hover:text-slate-900">
              <span className="select-none">▸ List &amp; bulk actions ({list.length})</span>
            </summary>
            <div className="mt-3">
          <BulkProvider>
            <Table>
              <thead>
                <tr>
                  <Th className="w-10"><BulkSelectAll /></Th>
                  <Th>Date</Th>
                  <Th>Time</Th>
                  <Th>Class</Th>
                  <Th>Location</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <Td><BulkCheckbox id={s.id} /></Td>
                    <Td className="font-medium">
                      <Link href={`/admin/attendance/${s.id}`} className="text-green-700 hover:underline">
                        {formatDate(s.session_date)}
                      </Link>
                    </Td>
                    <Td>{formatTime(s.start_time)}–{formatTime(s.end_time)}</Td>
                    <Td className="text-slate-600">{s.classes?.name ?? "—"}</Td>
                    <Td className="text-slate-500">{s.location ?? "—"}</Td>
                    <Td>
                      <Badge tone={s.status === "canceled" ? "red" : s.status === "completed" ? "green" : "blue"}>
                        {s.status}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        {s.status === "canceled" ? (
                          <form action={restoreSession}>
                            <input type="hidden" name="id" value={s.id} />
                            <Button type="submit" variant="secondary">Restore</Button>
                          </form>
                        ) : (
                          <form action={cancelSession}>
                            <input type="hidden" name="id" value={s.id} />
                            <Button type="submit" variant="secondary">Cancel</Button>
                          </form>
                        )}
                        <form action={deleteSession}>
                          <input type="hidden" name="id" value={s.id} />
                          <ConfirmButton label="Delete" confirmText="Delete this session?" />
                        </form>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="px-5 pb-5">
              <BulkBar
                action={deleteSessions}
                label="session"
                confirmText="Delete {n} selected session(s)?"
              />
            </div>
          </BulkProvider>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
