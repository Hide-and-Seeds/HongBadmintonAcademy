"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["present", "late", "absent", "excused"] as const;

// Manual attendance override for coaches — fallback when an NFC tap is missed.
// RLS (attendance_write) already lets a coach write attendance for their own
// students, so the normal client is enough.
export async function markAttendance(formData: FormData) {
  const session_id = String(formData.get("session_id"));
  const student_id = String(formData.get("student_id"));
  const status = String(formData.get("status"));
  if (!session_id || !student_id) return;
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;

  const supabase = await createClient();
  await supabase.from("attendance").upsert(
    { session_id, student_id, status, flagged: status === "absent" || status === "late" },
    { onConflict: "session_id,student_id" },
  );

  revalidatePath("/coach/attendance");
}

// Quick per-session performance mark (1–5), recorded right after the session
// while it's fresh — replaces the old weekly mark. Upserts so re-tapping a
// different number overwrites. RLS (session_marks) gates it to the student's
// coach.
export async function markSessionMark(formData: FormData) {
  const session_id = String(formData.get("session_id"));
  const student_id = String(formData.get("student_id"));
  const rating = Number(formData.get("rating"));
  if (!session_id || !student_id) return;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("session_marks").upsert(
    { session_id, student_id, coach_id: user?.id ?? null, rating },
    { onConflict: "session_id,student_id" },
  );

  revalidatePath("/coach/attendance");
}
