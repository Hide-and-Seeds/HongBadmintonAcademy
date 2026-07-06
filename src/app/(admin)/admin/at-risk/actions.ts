"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createNotifications } from "@/lib/notifications";
import { pushToUsers } from "@/lib/push";

// One-tap "we miss you" nudge to a lapsed student's parent (in-app + web push).
export async function nudgeParent(formData: FormData) {
  await requireRole("admin");
  const parentId = String(formData.get("parent_id") ?? "").trim();
  const studentName = String(formData.get("student_name") ?? "").trim() || "your child";
  if (!parentId) return;

  const title = "We miss you at training!";
  const body = `${studentName} hasn't been to class in a while — we'd love to see them back on court soon. 🏸`;
  await createNotifications([parentId], { type: "winback", title, body, url: "/parent/schedule" });
  try {
    await pushToUsers([parentId], { title, body, url: "/parent/schedule", tag: "winback" });
  } catch {
    /* push is best-effort */
  }
  revalidatePath("/admin/at-risk");
}
