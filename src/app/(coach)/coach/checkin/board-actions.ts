"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/types";

const STATUSES: AttendanceStatus[] = ["present", "late", "absent", "excused"];

export async function setAttendanceAction(input: {
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input?.session_id || !input?.student_id) return { ok: false, error: "missing" };
  if (!STATUSES.includes(input.status)) return { ok: false, error: "bad status" };

  const supabase = await createClient();
  const { error } = await supabase.from("attendance").upsert(
    {
      session_id: input.session_id,
      student_id: input.student_id,
      status: input.status,
      flagged: input.status === "absent" || input.status === "late",
    },
    { onConflict: "session_id,student_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/coach/checkin");
  return { ok: true };
}

export async function setPerfAction(input: {
  session_id: string;
  student_id: string;
  rating: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input?.session_id || !input?.student_id) return { ok: false, error: "missing" };
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, error: "bad rating" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("session_marks").upsert(
    {
      session_id: input.session_id,
      student_id: input.student_id,
      coach_id: user?.id ?? null,
      rating: input.rating,
    },
    { onConflict: "session_id,student_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/coach/checkin");
  return { ok: true };
}

// Bulk-marks the given student_ids as 'present' for the session in a single
// upsert. Used by the "Mark N present" speed button — only the row IDs the
// caller selects are touched.
export async function markAllPresentAction(input: {
  session_id: string;
  student_ids: string[];
}): Promise<{ ok: boolean; count: number; error?: string }> {
  if (!input?.session_id || !Array.isArray(input.student_ids) || input.student_ids.length === 0) {
    return { ok: false, count: 0, error: "missing" };
  }
  const supabase = await createClient();
  const rows = input.student_ids.map((student_id) => ({
    session_id: input.session_id,
    student_id,
    status: "present" as const,
    flagged: false,
  }));
  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "session_id,student_id" });
  if (error) return { ok: false, count: 0, error: error.message };
  revalidatePath("/coach/checkin");
  return { ok: true, count: rows.length };
}
