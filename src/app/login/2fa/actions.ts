"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, homeForRole } from "@/lib/auth";
import { consumeBackupCode } from "@/lib/mfa-codes";

// Complete the second factor at login. On success the session is upgraded to
// aal2 and we route by role.
export async function verifyLoginTotp(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "";
  const back = (msg: string) => redirect(`/login/2fa?error=${encodeURIComponent(msg)}${next ? `&next=${encodeURIComponent(next)}` : ""}`);

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = (factors?.totp ?? []).find((f) => f.status === "verified") ?? (factors?.totp ?? [])[0];
  if (!totp) redirect("/login");

  const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
  if (chErr) back(chErr.message);
  const { error } = await supabase.auth.mfa.verify({ factorId: totp.id, challengeId: ch!.id, code });
  if (error) back("That code didn't match — try the current one from your app.");

  const profile = await getProfile();
  redirect(next || homeForRole(profile?.role ?? "admin"));
}

// Recover with a one-time backup code (lost device). A valid code removes the
// TOTP factor (dropping the aal2 requirement) so the staffer gets in with just
// their password, then re-enrols. Self-service — no super-admin needed.
export async function useBackupCode(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ok = await consumeBackupCode(user!.id, code);
  if (!ok) redirect(`/login/2fa?mode=backup&error=${encodeURIComponent("That backup code is invalid or already used.")}`);

  // Wipe factors → nextLevel drops to aal1 → they're through.
  const db = createAdminClient();
  const { data } = await db.auth.admin.mfa.listFactors({ userId: user!.id });
  for (const f of (data as any)?.factors ?? []) await db.auth.admin.mfa.deleteFactor({ id: f.id, userId: user!.id });

  const profile = await getProfile();
  redirect(homeForRole(profile?.role ?? "admin"));
}

// Bail out of the 2FA step (wrong account / lost device) → back to a clean login.
export async function cancelLoginTotp(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
