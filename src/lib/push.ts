import webpush from "web-push";

const PUBLIC = (process.env.VAPID_PUBLIC_KEY ?? "").trim();
const PRIVATE = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
const RAW_SUBJECT = (process.env.VAPID_SUBJECT ?? "").trim();
const SUBJECT =
  RAW_SUBJECT && (RAW_SUBJECT.startsWith("mailto:") || RAW_SUBJECT.startsWith("https://"))
    ? RAW_SUBJECT
    : "mailto:admin@hongbadminton.example";

let configured = false;
let configError: string | null = null;
function ensure(): { ok: boolean; error?: string } {
  if (configured) return { ok: true };
  if (configError) return { ok: false, error: configError };
  if (!PUBLIC || !PRIVATE) return { ok: false, error: "VAPID env vars missing" };
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    configured = true;
    return { ok: true };
  } catch (e: any) {
    configError = `setVapidDetails: ${e?.message ?? String(e)}`;
    console.error("[push] VAPID config failed", { subject: SUBJECT, pubLen: PUBLIC.length, privLen: PRIVATE.length, error: configError });
    return { ok: false, error: configError };
  }
}

export function getVapidPublicKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? PUBLIC;
}

export function isPushConfigured(): boolean {
  return Boolean(PUBLIC && PRIVATE);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushSubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Sends one push to one subscription. Returns ok / 410-gone (caller deletes) / error.
export async function sendPush(
  sub: PushSubRow,
  payload: PushPayload,
): Promise<{ ok: boolean; gone?: boolean; error?: string }> {
  const e0 = ensure();
  if (!e0.ok) return { ok: false, error: e0.error ?? "VAPID not configured" };
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 },
    );
    return { ok: true };
  } catch (e: any) {
    const status = e?.statusCode as number | undefined;
    if (status === 404 || status === 410) return { ok: false, gone: true };
    const msg = e?.body ?? e?.message ?? String(e);
    console.error("[push] sendNotification failed", { status, msg, endpoint: sub.endpoint.slice(0, 60) });
    return { ok: false, error: `[${status ?? "?"}] ${msg}` };
  }
}
