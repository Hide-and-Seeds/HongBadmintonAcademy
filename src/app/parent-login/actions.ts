"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setParentSessionCookie } from "@/lib/parent-auth";
import { homeForRole, isAdminRole } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { getBaseUrl } from "@/lib/url";

// Forgot password → Supabase sends a reset email. We always report success so
// the form never reveals whether an email is registered.
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect(`/parent-login/forgot?error=${encodeURIComponent("Enter your email.")}`);

  const supabase = await createClient();
  const baseUrl = await getBaseUrl();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${baseUrl}/parent-login/reset` });
  redirect("/parent-login/forgot?sent=1");
}

// Set a new password from the reset link, then sign the user in by role
// (parents on the app cookie, staff on the Supabase session). Works for any
// account, so it doubles as staff password recovery.
export async function setNewPassword(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const back = (msg: string): never =>
    redirect(`/parent-login/reset?code=${encodeURIComponent(code)}&error=${encodeURIComponent(msg)}`);
  if (password.length < 8) back("Password must be at least 8 characters.");
  if (password !== confirm) back("Passwords don't match — try again.");

  const supabase = await createClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirect(`/parent-login/forgot?error=${encodeURIComponent("This reset link has expired. Please request a new one.")}`);
    }
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/parent-login/forgot?error=${encodeURIComponent("This reset link is invalid. Please request a new one.")}`);
  }

  const { error: upErr } = await supabase.auth.updateUser({ password });
  if (upErr) back(upErr.message);

  const db = createAdminClient();
  const { data: prof } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = prof?.role as Role | undefined;

  if (role === "parent") {
    await supabase.auth.signOut({ scope: "local" });
    await setParentSessionCookie(user.id);
    redirect("/parent");
  }
  if (role && (isAdminRole(role) || role === "coach")) {
    redirect(homeForRole(role));
  }
  await supabase.auth.signOut({ scope: "local" });
  redirect(`/login?error=${encodeURIComponent("This account has no access yet. Contact the academy.")}`);
}
