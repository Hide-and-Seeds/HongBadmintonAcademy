import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";
import { normalizePhoneMY } from "@/lib/wa";

// Proposal v7 §7.2: parents bypass Supabase Auth entirely. A signed cookie
// proves identity for one year. RLS is bypassed for parent reads — the parent
// pages use the service-role client and filter by the cookie-resolved profile
// id explicitly. Admin & coach still use Supabase Auth (unchanged).

const COOKIE_NAME = "hba_parent";
const COOKIE_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // login links valid 7 days
const PIN_LOCKOUT_AFTER = 5;                     // wrong attempts before lock

// ─── Secret ──────────────────────────────────────────────────────────────────
// PARENT_AUTH_SECRET must be set in production (32+ chars). Locally we derive
// from the Supabase service key so dev works out of the box but isn't shared.
function getSecret(): string {
  const s = process.env.PARENT_AUTH_SECRET;
  if (s && s.length >= 16) return s;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!fallback) throw new Error("PARENT_AUTH_SECRET not configured");
  return `hba-parent-auth::${fallback}`;
}

// ─── Cookie sign / verify (HMAC-SHA256) ──────────────────────────────────────
function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

interface SessionPayload {
  pid: string;     // profile id
  iat: number;     // issued at (unix seconds)
  exp: number;     // expires at (unix seconds)
}

function signSession(payload: SessionPayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const mac = createHmac("sha256", getSecret()).update(body).digest();
  return `${body}.${b64url(mac)}`;
}

function verifySession(raw: string): SessionPayload | null {
  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const body = raw.slice(0, dot);
  const givenMac = b64urlDecode(raw.slice(dot + 1));
  const wantMac = createHmac("sha256", getSecret()).update(body).digest();
  if (givenMac.length !== wantMac.length) return null;
  if (!timingSafeEqual(givenMac, wantMac)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as SessionPayload;
    if (typeof payload?.pid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Cookie write / clear ────────────────────────────────────────────────────
export async function setParentSessionCookie(profileId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const value = signSession({ pid: profileId, iat: now, exp: now + COOKIE_TTL_SECONDS });
  const jar = await cookies();
  jar.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_TTL_SECONDS,
  });
}

export async function clearParentSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

// Read & verify the cookie. Returns the parent profile id or null.
export async function getParentIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const payload = verifySession(raw);
  return payload?.pid ?? null;
}

// Edge-friendly variant — middleware passes a raw cookie value.
export function verifyParentCookieValue(raw: string | undefined): string | null {
  if (!raw) return null;
  return verifySession(raw)?.pid ?? null;
}

// ─── Profile lookup ──────────────────────────────────────────────────────────
export async function getParentProfile(): Promise<Profile | null> {
  const id = await getParentIdFromCookie();
  if (!id) return null;
  const db = createAdminClient();
  const { data } = await db.from("profiles").select("*").eq("id", id).eq("role", "parent").maybeSingle();
  return (data as Profile) ?? null;
}

export async function requireParent(): Promise<Profile> {
  const p = await getParentProfile();
  if (!p) redirect("/parent-login");
  return p;
}

// ─── PIN hash / verify (scrypt) ──────────────────────────────────────────────
// Format: scrypt$<saltHex>$<hashHex>
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pin, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const want = Buffer.from(parts[2], "hex");
  const got = scryptSync(pin, salt, want.length, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

// ─── PIN check + lockout (Layer 1 self-recovery) ─────────────────────────────
export type PinCheckResult =
  | { ok: true; profileId: string }
  | { ok: false; reason: "no-match" | "locked" | "wrong-pin"; remaining?: number };

// Phone (any local-ish format) + 4-digit PIN. Returns the parent profile id on
// success and applies the standard lock-after-5 policy on failure.
export async function checkPhonePin(rawPhone: string, pin: string): Promise<PinCheckResult> {
  if (!isValidPin(pin)) return { ok: false, reason: "wrong-pin" };
  const phone = normalizePhoneMY(rawPhone);
  if (!phone) return { ok: false, reason: "no-match" };

  const db = createAdminClient();
  const { data: rows } = await db
    .from("profiles")
    .select("id, role, phone, pin_hash, pin_failed_count, pin_locked_at")
    .eq("role", "parent")
    .eq("phone", phone)
    .limit(1);

  const row = rows?.[0];
  if (!row || !row.pin_hash) return { ok: false, reason: "no-match" };

  if (row.pin_locked_at) return { ok: false, reason: "locked" };

  if (verifyPin(pin, row.pin_hash)) {
    if ((row.pin_failed_count ?? 0) > 0) {
      await db.from("profiles").update({ pin_failed_count: 0 }).eq("id", row.id);
    }
    return { ok: true, profileId: row.id };
  }

  const failed = (row.pin_failed_count ?? 0) + 1;
  const updates: Record<string, unknown> = { pin_failed_count: failed };
  if (failed >= PIN_LOCKOUT_AFTER) updates.pin_locked_at = new Date().toISOString();
  await db.from("profiles").update(updates).eq("id", row.id);

  if (failed >= PIN_LOCKOUT_AFTER) return { ok: false, reason: "locked" };
  return { ok: false, reason: "wrong-pin", remaining: PIN_LOCKOUT_AFTER - failed };
}

// ─── One-time login tokens (admin → parent) ──────────────────────────────────
export async function createLoginToken(profileId: string, createdBy: string | null): Promise<string> {
  const token = b64url(randomBytes(24));
  const expires = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const db = createAdminClient();
  const { error } = await db.from("parent_login_tokens").insert({
    token,
    profile_id: profileId,
    expires_at: expires,
    created_by: createdBy,
  });
  if (error) throw new Error(error.message);
  return token;
}

export type TokenConsumeResult =
  | { ok: true; profileId: string; needsPin: boolean }
  | { ok: false; reason: "missing" | "used" | "expired" | "bad-profile" };

export async function consumeLoginToken(token: string): Promise<TokenConsumeResult> {
  if (!token) return { ok: false, reason: "missing" };
  const db = createAdminClient();
  const { data: row } = await db
    .from("parent_login_tokens")
    .select("id, profile_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (!row) return { ok: false, reason: "missing" };
  if (row.used_at) return { ok: false, reason: "used" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };

  const { data: profile } = await db
    .from("profiles")
    .select("id, role, pin_hash, pin_locked_at, pin_failed_count")
    .eq("id", row.profile_id)
    .maybeSingle();
  if (!profile || profile.role !== "parent") return { ok: false, reason: "bad-profile" };

  // Token consume also clears any lockout (admin-triggered = unlock).
  await db.from("profiles")
    .update({ pin_locked_at: null, pin_failed_count: 0 })
    .eq("id", profile.id);
  await db.from("parent_login_tokens").update({ used_at: new Date().toISOString() }).eq("id", row.id);

  return { ok: true, profileId: profile.id, needsPin: !profile.pin_hash };
}

// ─── PIN set / reset (called after token consume or by parent in settings) ──
export async function setPin(profileId: string, pin: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidPin(pin)) return { ok: false, error: "PIN must be exactly 4 digits" };
  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({
      pin_hash: hashPin(pin),
      pin_set_at: new Date().toISOString(),
      pin_failed_count: 0,
      pin_locked_at: null,
    })
    .eq("id", profileId)
    .eq("role", "parent");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Admin "Unlock PIN" — clears the lockout without generating a new link.
export async function adminUnlockPin(profileId: string): Promise<void> {
  const db = createAdminClient();
  await db.from("profiles")
    .update({ pin_locked_at: null, pin_failed_count: 0 })
    .eq("id", profileId)
    .eq("role", "parent");
}

// Admin "Clear PIN" — forces the parent to set a new PIN on next login link.
export async function adminClearPin(profileId: string): Promise<void> {
  const db = createAdminClient();
  await db.from("profiles")
    .update({ pin_hash: null, pin_set_at: null, pin_failed_count: 0, pin_locked_at: null })
    .eq("id", profileId)
    .eq("role", "parent");
}
