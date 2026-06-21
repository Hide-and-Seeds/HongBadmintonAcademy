"use server";

import { createClient } from "@/lib/supabase/server";
import { pushToUsers, isPushConfigured } from "@/lib/push";

type SubInput = { endpoint: string; p256dh: string; auth: string; user_agent?: string };

// Coaches are Supabase-authed, so the subscription saves under their own session
// (RLS scopes it to auth.uid()).
export async function saveCoachPush(input: SubInput): Promise<{ ok: boolean; error?: string }> {
  if (!input?.endpoint || !input?.p256dh || !input?.auth) return { ok: false, error: "missing fields" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.user_agent ?? null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function removeCoachPush(endpoint: string): Promise<{ ok: boolean; error?: string }> {
  if (!endpoint) return { ok: false, error: "missing endpoint" };
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function sendTestCoachPush(): Promise<{ ok: boolean; sent: number; failed: number; error?: string }> {
  if (!isPushConfigured()) return { ok: false, sent: 0, failed: 0, error: "Push isn't set up yet." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, sent: 0, failed: 0, error: "not signed in" };
  const r = await pushToUsers([user.id], {
    title: "Hong Badminton Academy",
    body: "Notifications are on.",
    url: "/coach",
    tag: "hba-test",
  });
  return {
    ok: r.sent > 0,
    sent: r.sent,
    failed: r.failed,
    error: r.sent > 0 ? undefined : "No device subscribed yet — tap Enable first.",
  };
}
