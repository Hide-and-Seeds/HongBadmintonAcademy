import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// Constant-time Bearer check for Vercel Cron routes. Vercel sends
// `Authorization: Bearer <CRON_SECRET>` on scheduled invocations. We accept the
// header only — never a `?secret=` query param, which would leak into access
// logs / Referer headers.
export function isAuthorizedCron(req: Request): boolean {
  if (!env.cronSecret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
