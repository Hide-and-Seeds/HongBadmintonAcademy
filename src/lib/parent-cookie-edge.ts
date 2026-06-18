// Edge-runtime safe parent session cookie verification. Used by middleware,
// which must NOT pull in scrypt (node-only). All HMAC ops below use Web Crypto.

const COOKIE_NAME = "hba_parent";

function getSecret(): string {
  const s = process.env.PARENT_AUTH_SECRET;
  if (s && s.length >= 16) return s;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!fallback) return "";
  return `hba-parent-auth::${fallback}`;
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  // atob is available in Edge runtime.
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

interface SessionPayload {
  pid: string;
  iat: number;
  exp: number;
}

export async function verifyParentCookieValue(raw: string | undefined): Promise<string | null> {
  if (!raw) return null;
  const secret = getSecret();
  if (!secret) return null;
  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const body = raw.slice(0, dot);
  const givenMac = b64urlDecode(raw.slice(dot + 1));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const wantBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const wantMac = new Uint8Array(wantBuf);
  if (!timingSafeEqual(givenMac, wantMac)) return null;

  try {
    const json = new TextDecoder().decode(b64urlDecode(body));
    const payload = JSON.parse(json) as SessionPayload;
    if (typeof payload?.pid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.pid;
  } catch {
    return null;
  }
}

export const PARENT_COOKIE_NAME = COOKIE_NAME;
