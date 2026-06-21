"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Coaches are Supabase-authed (a real session), so we verify the current
// password by re-signing in — which just refreshes THEIR OWN session, no
// sign-out — then apply the change with the service-role admin API (so the
// email is set directly, no confirmation email needed).

export async function updateCoachContact(formData: FormData) {
  const me = await requireRole("coach");
  const currentEmail = me.email;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const current = String(formData.get("current") ?? "");

  function fail(msg: string): never {
    redirect(`/coach/account?error=${encodeURIComponent(msg)}`);
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("Enter a valid email address.");

  const emailChanged = !currentEmail || email !== currentEmail.toLowerCase();
  if (emailChanged && currentEmail) {
    if (!current) fail("Enter your current password to change your email.");
    const supabase = await createClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: currentEmail, password: current });
    if (signInErr) fail("Current password is incorrect.");
  }

  const db = createAdminClient();
  if (emailChanged) {
    const { error: authErr } = await db.auth.admin.updateUserById(me.id, { email, email_confirm: true });
    if (authErr) fail(authErr.message);
  }
  const { error } = await db.from("profiles").update({ email, phone: phone || null }).eq("id", me.id);
  if (error) fail(error.message);

  redirect("/coach/account?saved=contact");
}

export async function changeCoachPassword(formData: FormData) {
  const me = await requireRole("coach");
  const current = String(formData.get("current") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  function fail(msg: string): never {
    redirect(`/coach/account?error=${encodeURIComponent(msg)}`);
  }
  const email = me.email;
  if (!email) fail("No email on file — contact the academy.");
  if (newPassword.length < 8) fail("New password must be at least 8 characters.");
  if (newPassword !== confirm) fail("New passwords don't match.");
  if (newPassword === current) fail("New password must be different from the current one.");

  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: current });
  if (signInErr) fail("Current password is incorrect.");

  const db = createAdminClient();
  const { error } = await db.auth.admin.updateUserById(me.id, { password: newPassword });
  if (error) fail(error.message);

  redirect("/coach/account?saved=1");
}
