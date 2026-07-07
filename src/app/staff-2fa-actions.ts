"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateBackupCodes } from "@/lib/mfa-codes";

// Staff (admin / super-admin / coach) TOTP two-factor, on Supabase native MFA.
// Enroll → show QR/secret → verify a 6-digit code to activate. Parents use the
// cookie session and never hit this.

export async function enrollTotp(): Promise<{ ok: boolean; error?: string; factorId?: string; qr?: string; secret?: string; uri?: string }> {
  await requireRole(["admin", "coach"], { skipMfa: true });
  const supabase = await createClient();

  // Drop any leftover un-verified factor so re-enrolling is clean.
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `authenticator-${Date.now()}` });
  if (error) return { ok: false, error: error.message };
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
}

export async function verifyTotp(factorId: string, code: string): Promise<{ ok: boolean; error?: string; backupCodes?: string[] }> {
  const me = await requireRole(["admin", "coach"], { skipMfa: true });
  const supabase = await createClient();
  const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr) return { ok: false, error: chErr.message };
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
  if (error) return { ok: false, error: error.message };
  // Fresh set of one-time backup codes, shown once.
  const backupCodes = await generateBackupCodes(me.id);
  return { ok: true, backupCodes };
}

export async function regenerateBackupCodes(): Promise<{ ok: boolean; error?: string; codes?: string[] }> {
  const me = await requireRole(["admin", "coach"]);
  const codes = await generateBackupCodes(me.id);
  return { ok: true, codes };
}

export async function unenrollTotp(factorId: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["admin", "coach"]);
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
