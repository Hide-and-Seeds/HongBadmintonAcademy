import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { claimNextQueued } from "@/lib/reminders";

export const runtime = "nodejs";

// Polled by the always-on worker. Authenticated with the shared worker secret.
// Returns at most one queued reminder, and only when the cautious throttle
// policy permits right now; otherwise { message: null, reason }.
export async function GET(req: NextRequest) {
  if (!env.waWorkerSecret || req.headers.get("authorization") !== `Bearer ${env.waWorkerSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await claimNextQueued());
  } catch (e) {
    return NextResponse.json({ message: null, reason: "error", error: (e as Error).message }, { status: 500 });
  }
}
