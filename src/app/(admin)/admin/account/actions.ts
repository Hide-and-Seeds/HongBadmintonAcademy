"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin self-service is phone + password only. The login EMAIL is intentionally
// NOT editable here: admins are the top recovery role, so a mistyped email would
// lock the root account out with no in-app recovery. Admin emails are managed
// via the Supabase dashboard / create-admin script.

export async function updateAdminPhone(formData: FormData) {
  const me = await requireRole("admin");
  const phone = String(formData.get("phone") ?? "").trim();
  const db = createAdminClient();
  const { error } = await db.from("profiles").update({ phone: phone || null }).eq("id", me.id);
  if (error) redirect(`/admin/account?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/account?saved=contact");
}

export async function changeAdminPassword(formData: FormData) {
  const me = await requireRole("admin");
  const current = String(formData.get("current") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  function fail(msg: string): never {
    redirect(`/admin/account?error=${encodeURIComponent(msg)}`);
  }
  const email = me.email;
  if (!email) fail("No email on file — manage this account in Supabase.");
  if (newPassword.length < 8) fail("New password must be at least 8 characters.");
  if (newPassword !== confirm) fail("New passwords don't match.");
  if (newPassword === current) fail("New password must be different from the current one.");

  // Verify the current password (re-sign-in refreshes this admin's own session).
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: current });
  if (signInErr) fail("Current password is incorrect.");

  const db = createAdminClient();
  const { error } = await db.auth.admin.updateUserById(me.id, { password: newPassword });
  if (error) fail(error.message);

  redirect("/admin/account?saved=1");
}
