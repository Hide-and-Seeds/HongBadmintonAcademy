"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { env } from "@/lib/env";

// No worker, no bot: the admin posts the notice into the community Announcements
// group in WhatsApp by hand (one post, every parent sees it). This just records
// that a post was made so the history / WhatsApp Log stay accurate. Logged as a
// 'custom' message (the message_type enum has no 'announcement'); recipient is
// the community, not a phone number.
export async function logAnnouncement(formData: FormData) {
  const body = String(formData.get("text") ?? "").trim();
  if (!body) return;

  const supabase = await createClient();
  await supabase.from("messages").insert({
    type: "custom",
    recipient_phone: "community",
    body,
    provider: "wa_click",
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  revalidatePath("/admin/announce");
}

// Worker-sent announcement: queue a free-text notice for the worker to post to
// the Community Announcements group (e.g. holiday greetings). No manual paste.
// recordQueueResult logs it ('custom', recipient 'community') and the history
// table below picks it up on send. Admin-only.
export async function postCommunityMessage(formData: FormData) {
  await requireRole("admin");
  const body = String(formData.get("text") ?? "").trim();
  if (!body) redirect(`/admin/announce?error=${encodeURIComponent("Message can't be empty")}`);
  if (!env.waCommunityGroupId) {
    redirect(`/admin/announce?error=${encodeURIComponent("No Community group configured (set WA_COMMUNITY_GROUP_ID)")}`);
  }

  const db = createAdminClient();
  const { error } = await db
    .from("message_queue")
    .insert({ kind: "community_custom", recipient_phone: env.waCommunityGroupId, body });
  if (error) redirect(`/admin/announce?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/announce");
  redirect("/admin/announce?posted=1");
}
