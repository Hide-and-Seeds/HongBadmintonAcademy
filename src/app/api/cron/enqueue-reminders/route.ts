import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { enqueueDueReminders } from "@/lib/reminders";

export const runtime = "nodejs";

// Daily Vercel Cron (see vercel.json): web-pushes parents whose invoice is due
// today or has hit an overdue milestone. WhatsApp fee reminders were removed
// (too risky). Secured by CRON_SECRET (Bearer header on scheduled invocations).
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await enqueueDueReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
