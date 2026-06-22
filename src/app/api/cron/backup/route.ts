import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDatabaseBackup, pruneHistory } from "@/lib/backup";
import { isAuthorizedCron } from "@/lib/cron";

export const runtime = "nodejs";
// Reads every table into one JSON file — give it room past the short serverless
// default (60s is the Hobby cap; raise on Pro if the dataset grows large).
export const maxDuration = 60;

// Daily Vercel Cron (see vercel.json): writes a JSON snapshot of every public
// table to the private `backups` storage bucket. Runs headless with the
// service-role client (no user session). Secured by CRON_SECRET, which Vercel
// sends as a Bearer header on scheduled invocations.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = createAdminClient();
    const result = await runDatabaseBackup(db);
    // Snapshot first, THEN trim old history (it's preserved in today's backup).
    const pruned = await pruneHistory(db);
    return NextResponse.json({ ok: true, ...result, pruned });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
