import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Shared NFC tap engine. Resolves a tag UID → student → today's session, then
// records tap-in / tap-out. Used by both the hardware bridge route
// (/api/nfc/tap) and the coach phone-reader page (Web NFC).

export interface TapInput {
  tagUid: string;
  readerId?: string | null;
  classId?: string | null;
  sessionId?: string | null;
  // When set (coach phone-reader), the resolved session's class must be in this
  // list — a coach may only tap students in their own classes. Null = no limit
  // (trusted hardware bridge / admin).
  restrictClassIds?: string[] | null;
}

export interface TapResult {
  ok: boolean;
  status: number; // suggested HTTP status for the API route
  action?: "tap_in" | "tap_out";
  student?: string;
  sessionId?: string;
  at?: string;
  error?: string;
}

// Tags can be registered in different formats depending on the reader (colons,
// case). Normalize for a forgiving fallback match.
const norm = (u: string) => u.replace(/[^a-z0-9]/gi, "").toUpperCase();

export async function ingestTap(input: TapInput): Promise<TapResult> {
  const tagUid = input.tagUid?.trim();
  if (!tagUid) return { ok: false, status: 400, error: "tag_uid required" };

  const db = createAdminClient();
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" }); // YYYY-MM-DD, MYT

  const logEvent = async (fields: Record<string, unknown>) => {
    await db.from("nfc_tap_events").insert({
      tag_uid: tagUid,
      reader_id: input.readerId ?? null,
      class_id: input.classId ?? null,
      raw: input as unknown,
      ...fields,
    });
  };

  // 1. Resolve tag → student (exact, then normalized fallback).
  let student: { id: string; full_name: string } | null = null;
  const exact = await db.from("students").select("id, full_name").eq("nfc_tag_uid", tagUid).maybeSingle();
  student = exact.data;
  if (!student) {
    const n = norm(tagUid);
    const { data: all } = await db
      .from("students")
      .select("id, full_name, nfc_tag_uid")
      .not("nfc_tag_uid", "is", null);
    const hit = (all ?? []).find((s: any) => s.nfc_tag_uid && norm(s.nfc_tag_uid) === n);
    student = hit ? { id: hit.id, full_name: hit.full_name } : null;
  }

  if (!student) {
    await logEvent({ processed: false, error: "Unknown tag" });
    return { ok: false, status: 404, error: "Unknown tag" };
  }

  // 2. Resolve session: explicit > class today > enrolled class today.
  let session: { id: string; start_time: string; grace_minutes: number; class_id: string } | null = null;

  if (input.sessionId) {
    const { data } = await db
      .from("sessions")
      .select("id, start_time, grace_minutes, class_id")
      .eq("id", input.sessionId)
      .maybeSingle();
    session = data;
  } else {
    const { data: enr } = await db
      .from("enrollments")
      .select("class_id")
      .eq("student_id", student.id)
      .eq("active", true);
    const classIds = input.classId ? [input.classId] : (enr ?? []).map((e: { class_id: string }) => e.class_id);

    if (classIds.length) {
      const { data: sessions } = await db
        .from("sessions")
        .select("id, start_time, end_time, grace_minutes, class_id, status")
        .in("class_id", classIds)
        .eq("session_date", today)
        .order("start_time", { ascending: true });
      const list = sessions ?? [];
      session = list.find((s: { status: string }) => s.status === "in_progress") ?? list[0] ?? null;
    }
  }

  if (!session) {
    await logEvent({ student_id: student.id, processed: false, error: "No session today" });
    return { ok: false, status: 404, error: "No session found for today", student: student.full_name };
  }

  // Authorization for the coach phone-reader: the session must belong to one of
  // the coach's own classes. Bypassed for trusted callers (restrictClassIds null).
  if (input.restrictClassIds && !input.restrictClassIds.includes(session.class_id)) {
    await logEvent({ student_id: student.id, session_id: session.id, processed: false, error: "Not your class" });
    return { ok: false, status: 403, error: "Not your class", student: student.full_name };
  }

  // 3. Record tap-in / tap-out.
  const { data: existing } = await db
    .from("attendance")
    .select("id, tap_in_at, tap_out_at")
    .eq("session_id", session.id)
    .eq("student_id", student.id)
    .maybeSingle();

  let action: "tap_in" | "tap_out";

  if (!existing) {
    const start = new Date(`${today}T${session.start_time}+08:00`); // session times are MYT (UTC+8)
    const lateAfter = new Date(start.getTime() + session.grace_minutes * 60_000);
    const isLate = now > lateAfter;
    await db.from("attendance").insert({
      session_id: session.id,
      student_id: student.id,
      status: isLate ? "late" : "present",
      tap_in_at: now.toISOString(),
      tap_in_tag: tagUid,
      flagged: isLate,
      flag_reason: isLate ? "Late tap-in" : null,
    });
    action = "tap_in";
  } else {
    await db.from("attendance").update({ tap_out_at: now.toISOString() }).eq("id", existing.id);
    action = "tap_out";
  }

  await db.from("nfc_tap_events").insert({
    tag_uid: tagUid,
    reader_id: input.readerId ?? null,
    class_id: session.class_id,
    session_id: session.id,
    student_id: student.id,
    tap_type: action === "tap_in" ? "in" : "out",
    processed: true,
    raw: input as unknown,
  });

  return {
    ok: true,
    status: 200,
    action,
    student: student.full_name,
    sessionId: session.id,
    at: now.toISOString(),
  };
}
