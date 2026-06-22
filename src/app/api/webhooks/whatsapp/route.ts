import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const runtime = "nodejs";

// Meta webhook verification (GET) — set this URL + verify token in the Meta app.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (
    p.get("hub.mode") === "subscribe" &&
    p.get("hub.verify_token") === env.whatsappVerifyToken
  ) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// Delivery-status callbacks → update the message log.
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Verify Meta's payload signature when the App Secret is configured. Ack-and-
  // ignore on mismatch so we never write message rows from a forged callback.
  if (env.whatsappAppSecret) {
    const given = req.headers.get("x-hub-signature-256") ?? "";
    const expected =
      "sha256=" + createHmac("sha256", env.whatsappAppSecret).update(raw).digest("hex");
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ ok: true });
    }
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const db = createAdminClient();
  const statuses =
    body?.entry?.flatMap(
      (e: any) => e?.changes?.flatMap((c: any) => c?.value?.statuses ?? []) ?? [],
    ) ?? [];

  for (const s of statuses) {
    const id = s?.id as string | undefined;
    const status = s?.status as string | undefined; // sent | delivered | read | failed
    if (!id || !status) continue;

    const patch: Record<string, unknown> = { status };
    if (status === "delivered") patch.delivered_at = new Date().toISOString();
    if (status === "read") patch.read_at = new Date().toISOString();
    if (status === "failed") patch.error = s?.errors?.[0]?.title ?? "Delivery failed";

    await db.from("messages").update(patch).eq("provider_message_id", id);
  }

  return NextResponse.json({ ok: true });
}
