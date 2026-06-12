"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
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

  const r = await ingestTap({ tagUid: tag, readerId: "phone" });
  revalidatePath("/coach/attendance");
  return { ok: r.ok, action: r.action, student: r.student, error: r.error };
}
