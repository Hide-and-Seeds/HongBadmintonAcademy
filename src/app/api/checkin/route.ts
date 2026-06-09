import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Manual check-in fallback for the live screen (when a card fails or there's no
// reader). Records a tap-in / tap-out for one student exactly like the NFC
// endpoint, but keyed by student_id and gated by the admin's session. No
// revalidate — the live screen reconciles via its own poll.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: { session_id?: string; student_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const { session_id, student_id } = body;
  if (!session_id || !student_id) {
    return NextResponse.json({ ok: false, error: "session_id and student_id required" }, { status: 400 });
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("session_date, start_time, grace_minutes")
    .eq("id", session_id)
    .maybeSingle();

  const { data: existing } = await supabase
    .from("attendance")
    .select("id, tap_out_at")
    .eq("session_id", session_id)
    .eq("student_id", student_id)
    .maybeSingle();

  const now = new Date();

  if (!existing) {
    let isLate = false;
    if (session) {
      // Session times are Malaysia local (UTC+8).
      const start = new Date(`${session.session_date}T${session.start_time}+08:00`);
      isLate = now > new Date(start.getTime() + (session.grace_minutes ?? 15) * 60_000);
    }
    const status = isLate ? "late" : "present";
    await supabase.from("attendance").insert({
      session_id,
      student_id,
      status,
      tap_in_at: now.toISOString(),
      flagged: isLate,
      flag_reason: isLate ? "Late tap-in" : null,
    });
    return NextResponse.json({ ok: true, action: "tap_in", status, student_id, at: now.toISOString() });
  }

  await supabase.from("attendance").update({ tap_out_at: now.toISOString() }).eq("id", existing.id);
  return NextResponse.json({ ok: true, action: "tap_out", student_id, at: now.toISOString() });
}
