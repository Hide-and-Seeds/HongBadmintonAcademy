import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Backup codes are stored only as a hash. Normalise (strip non-alphanumerics,
// lowercase) so "AB12-CD34" and "ab12cd34" match.
const hashCode = (c: string) =>
  createHash("sha256").update(c.replace(/[^a-z0-9]/gi, "").toLowerCase()).digest("hex");

// (Re)generate 8 one-time codes for a user, replacing any existing set. Returns
// the plaintext codes — shown to the user ONCE.
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const db = createAdminClient();
  await db.from("mfa_backup_codes").delete().eq("user_id", userId);
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const raw = randomBytes(4).toString("hex"); // 8 hex chars
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  await db.from("mfa_backup_codes").insert(codes.map((c) => ({ user_id: userId, code_hash: hashCode(c) })));
  return codes;
}

// Verify + consume one unused code. Returns true if it matched (and is now spent).
export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  if (!code?.trim()) return false;
  const db = createAdminClient();
  const { data } = await db
    .from("mfa_backup_codes")
    .select("id")
    .eq("user_id", userId)
    .eq("code_hash", hashCode(code))
    .is("used_at", null)
    .maybeSingle();
  if (!data) return false;
  await db.from("mfa_backup_codes").update({ used_at: new Date().toISOString() }).eq("id", data.id);
  return true;
}

export async function countUnusedBackupCodes(userId: string): Promise<number> {
  const db = createAdminClient();
  const { count } = await db
    .from("mfa_backup_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);
  return count ?? 0;
}
