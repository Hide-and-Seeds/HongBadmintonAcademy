import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { coachClassIds } from "../_data";
import { NfcScanner } from "@/components/nfc-scanner";
import { scanTap } from "./actions";

export const dynamic = "force-dynamic";

export default async function CheckinPage() {
  const me = await requireRole("coach");
  const supabase = await createClient();
  const classIds = await coachClassIds(supabase, me.id);
  const today = new Date().toLocaleDateString("en-CA");

  const { data: sessions } = classIds.length
    ? await supabase
        .from("sessions")
        .select("start_time, end_time, location, classes(name)")
        .in("class_id", classIds)
        .eq("session_date", today)
        .order("start_time")
    : { data: [] as any[] };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-in"
        description="Tap student NFC cards with your phone to record attendance. First tap = in, second = out."
      />

      <NfcScanner action={scanTap} />

      <Section title="Today's sessions" flush>
        {sessions && sessions.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {sessions.map((s: any, i: number) => (
              <li key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium text-slate-900">{s.classes?.name ?? "Class"}</span>
                <span className="text-slate-500">
                  {formatTime(s.start_time)}–{formatTime(s.end_time)} · {s.location ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5"><EmptyState message="No sessions scheduled today." /></div>
        )}
      </Section>
    </div>
  );
}
