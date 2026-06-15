import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInvoicesCore } from "@/lib/billing";
import { upsertCommunityMonthlyNotice } from "@/lib/reminders";
import { getBaseUrl } from "@/lib/url";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

// Monthly Vercel Cron (see vercel.json): auto-raises the *current* month's fee
// invoice for every active student that has a monthly fee plan assigned. Runs
// headless with the service-role client. Secured by CRON_SECRET (Bearer header).
// The daily enqueue-reminders cron then drip-sends due/overdue nudges as usual.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = req.nextUrl.searchParams.get("secret");
  const ok = auth === `Bearer ${env.cronSecret}` || secret === env.cronSecret;
  if (!env.cronSecret || !ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateInvoicesCore(createAdminClient());
    // Single monthly Community post — runs after the scorecard cron, so it can
    // compose the combined "reports + fees" notice (or a one-sided fallback).
    const notice = await upsertCommunityMonthlyNotice(await getBaseUrl());
    return NextResponse.json({ ok: true, ...result, notice });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
