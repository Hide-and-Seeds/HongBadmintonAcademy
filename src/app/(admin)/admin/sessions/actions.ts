"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sessionSchema } from "@/lib/validation";
import { enqueueSessionCancelNotice } from "@/lib/reminders";

// Sessions show on this page, the dashboard, attendance, and both parent views.
function revalidate() {
  revalidatePath("/admin/sessions");
  revalidatePath("/admin");
  revalidatePath("/admin/attendance");
  revalidatePath("/parent");
  revalidatePath("/parent/schedule");
}

// Create a single ad-hoc session (makeup / one-off) directly, without a recurring
// weekly schedule. Returns to the month the admin was viewing.
export async function createSession(formData: FormData) {
  const month = String(formData.get("month") ?? "");
  const back = month ? `/admin/sessions?month=${month}` : "/admin/sessions";
  const sep = back.includes("?") ? "&" : "?";

  const parsed = sessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`${back}${sep}error=${encodeURIComponent(parsed.error.issues[0].message)}`);

  const supabase = await createClient();
  // Inherit the branch from the parent class (RLS also requires the caller to be
  // allowed in that class's branch).
  const { data: cls } = await supabase.from("classes").select("branch_id").eq("id", parsed.data.class_id).maybeSingle();
  const { error } = await supabase
    .from("sessions")
    .insert({ ...parsed.data, branch_id: (cls as any)?.branch_id ?? null, status: "scheduled" });
  if (error) {
    const msg = error.code === "23505" ? "A session for that class already exists at that date & time." : error.message;
    redirect(`${back}${sep}error=${encodeURIComponent(msg)}`);
  }
  revalidate();
  redirect(`${back}${sep}created=1`);
}

export async function cancelSession(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { data: cur } = await supabase.from("sessions").select("status").eq("id", id).maybeSingle();
  await supabase.from("sessions").update({ status: "canceled" }).eq("id", id);
  // Notify parents on WhatsApp, but only on a real scheduled -> canceled transition.
  if (cur && cur.status !== "canceled") {
    try {
      await enqueueSessionCancelNotice(id);
    } catch {
      // A notification failure must not block the cancellation itself.
    }
  }
  revalidate();
}

export async function restoreSession(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("sessions").update({ status: "scheduled" }).eq("id", id);
  revalidate();
}

export async function deleteSession(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("sessions").delete().eq("id", id);
  revalidate();
}

// Delete from the session detail page, then return to the month list (the
// detail route would 404 if we stayed).
export async function removeSession(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("sessions").delete().eq("id", id);
  revalidate();
  redirect("/admin/sessions");
}

export async function deleteSessions(formData: FormData) {
  const ids = formData.getAll("ids").map(String);
  if (!ids.length) return;
  const supabase = await createClient();
  await supabase.from("sessions").delete().in("id", ids);
  revalidate();
}
