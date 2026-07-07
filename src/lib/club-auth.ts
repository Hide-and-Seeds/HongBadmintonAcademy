import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Club members don't have Supabase Auth accounts (they self-sign-up on /club
// without a password). Instead each member gets a stable, unguessable personal
// link — an HMAC-signed token of their member id — that opens their portal.
// Same trust model as the parent cookie: possession of the signed token proves
// identity. Low-sensitivity surface (name, tier, dues), so a bookmarkable link
// is an acceptable, password-free MVP. Rotate the secret to invalidate all.

const TTL_SECONDS = 365 * 24 * 60 * 60; // links valid ~1 year

function getSecret(): string {
  const s = process.env.PARENT_AUTH_SECRET;
  if (s && s.length >= 16) return s;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!fallback) throw new Error("PARENT_AUTH_SECRET not configured");
  return `hba-club-auth::${fallback}`;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

interface ClubToken {
  mid: string; // club_member id
  iat: number;
  exp: number;
}

export function signClubToken(memberId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(Buffer.from(JSON.stringify({ mid: memberId, iat: now, exp: now + TTL_SECONDS } satisfies ClubToken)));
  const mac = createHmac("sha256", getSecret()).update(body).digest();
  return `${body}.${b64url(mac)}`;
}

export function verifyClubToken(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const body = raw.slice(0, dot);
  const givenMac = b64urlDecode(raw.slice(dot + 1));
  const wantMac = createHmac("sha256", getSecret()).update(body).digest();
  if (givenMac.length !== wantMac.length) return null;
  if (!timingSafeEqual(givenMac, wantMac)) return null;
  try {
    const t = JSON.parse(b64urlDecode(body).toString("utf8")) as ClubToken;
    if (typeof t?.mid !== "string" || typeof t.exp !== "number") return null;
    if (t.exp < Math.floor(Date.now() / 1000)) return null;
    return t.mid;
  } catch {
    return null;
  }
}
