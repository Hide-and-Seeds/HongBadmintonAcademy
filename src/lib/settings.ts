import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const WORKER_PAUSED = "worker_paused";

// Is the WhatsApp drip worker paused? Read via the service-role client so the
// worker endpoint (no user session) can check it. Defaults to false (running).
export async function isWorkerPaused(): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", WORKER_PAUSED)
    .maybeSingle();
  return data?.value === true;
}

// Flip the worker pause flag (admin UI). Upsert keyed on the setting name.
export async function setWorkerPaused(paused: boolean): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("app_settings")
    .upsert(
      { key: WORKER_PAUSED, value: paused, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
}
