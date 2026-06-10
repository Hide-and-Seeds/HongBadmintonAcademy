"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Sessions show on this page, the dashboard, attendance, and both parent views.
function revalidate() {
  revalidatePath("/admin/sessions");
  revalidatePath("/admin");
  revalidatePath("/admin/attendance");
  revalidatePath("/parent");
  revalidatePath("/parent/schedule");
}

export async function cancelSession(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("sessions").update({ status: "canceled" }).eq("id", id);
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

export async function deleteSessions(formData: FormData) {
  const ids = formData.getAll("ids").map(String);
  if (!ids.length) return;
  const supabase = await createClient();
  await supabase.from("sessions").delete().in("id", ids);
  revalidate();
}
