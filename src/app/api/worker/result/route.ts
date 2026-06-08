import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { recordQueueResult } from "@/lib/reminders";

export const runtime = "nodejs";

// Worker reports the outcome of a drip send. Auth: shared worker secret.
export async function POST(req: NextRequest) {
  if (!env.waWorkerSecret || req.headers.get("authorization") !== `Bearer ${env.waWorkerSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    status?: "sent" | "failed";
    providerMessageId?: string;
    error?: string;
  };
  if (!body.id || (body.status !== "sent" && body.status !== "failed")) {
    return NextResponse.json({ error: "missing id/status" }, { status: 400 });
  }
  try {
    await recordQueueResult(body.id, body.status, body.providerMessageId, body.error);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
