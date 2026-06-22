"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ingestTap } from "@/lib/nfc";

// Record a tap scanned by a coach's phone (Web NFC) or typed manually. Runs the
// shared tap engine server-side — the NFC_API_KEY never reaches the browser;
// the coach's session is the authorization.
export async function scanTap(
  uid: string,
): Promise<{ ok: boolean; action?: "tap_in" | "tap_out"; student?: string; error?: string }> {
  const profile = await getProfile();
  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { ok: false, error: "Not authorized" };
  }

  const tag = uid?.trim();
  if (!tag) return { ok: false, error: "No tag UID" };

  // Coaches may only tap students in their own classes; admins tap anyone.
  let restrictClassIds: string[] | null = null;
  if (profile.role === "coach") {
    const sb = await createClient(); // RLS scopes these to the coach
    const [{ data: owned }, { data: assigned }] = await Promise.all([
      sb.from("classes").select("id"),
      sb.from("class_coaches").select("class_id"),
    ]);
    restrictClassIds = [
      ...new Set([
        ...((owned ?? []) as { id: string }[]).map((c) => c.id),
        ...((assigned ?? []) as { class_id: string }[]).map((c) => c.class_id),
      ]),
    ];
  }

  const r = await ingestTap({ tagUid: tag, readerId: "phone", restrictClassIds });
  revalidatePath("/coach/attendance");
  return { ok: r.ok, action: r.action, student: r.student, error: r.error };
}
