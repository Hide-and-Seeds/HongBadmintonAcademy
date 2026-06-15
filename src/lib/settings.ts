import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const WORKER_PAUSED = "worker_paused";
const FEE_REMINDERS_PAUSED = "fee_reminders_paused";
const SEND_POLICY = "send_policy";

// Generic app_settings value store. Read via the service-role client so
// worker/cron endpoints (no user session) can read it.
async function getValue<T>(key: string, fallback: T): Promise<T> {
  const db = createAdminClient();
  const { data } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value ?? fallback) as T;
}

async function setValue(key: string, value: unknown): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

// Whole WhatsApp drip worker: paused = drain nothing at all.
export const isWorkerPaused = () => getValue(WORKER_PAUSED, false);
export const setWorkerPaused = (v: boolean) => setValue(WORKER_PAUSED, v);

// Auto fee reminders only: paused = stop queuing new ones AND hold any already
// queued (worker still sends community posts etc.).
export const isFeeRemindersPaused = () => getValue(FEE_REMINDERS_PAUSED, false);
export const setFeeRemindersPaused = (v: boolean) => setValue(FEE_REMINDERS_PAUSED, v);

// Admin-tunable send schedule (the worker reads this each poll). Hours are MYT,
// 0–23; window is [start, end) so end=20 means last send by 19:59.
export type SendPolicy = {
  windowStartHour: number;
  windowEndHour: number;
  dailyCap: number;
  minGapMinutes: number;
};

export const DEFAULT_SEND_POLICY: SendPolicy = {
  windowStartHour: 9,
  windowEndHour: 20,
  dailyCap: 10,
  minGapMinutes: 10,
};

export async function getSendPolicy(): Promise<SendPolicy> {
  const v = await getValue<Partial<SendPolicy>>(SEND_POLICY, {});
  return { ...DEFAULT_SEND_POLICY, ...v };
}

export const setSendPolicy = (p: SendPolicy) => setValue(SEND_POLICY, p);
