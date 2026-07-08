import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section, Badge, Table, Th, Td, EmptyState, Textarea, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { env } from "@/lib/env";
import { AnnounceComposer } from "@/components/announce-composer";
import { getCommunityIntro } from "@/lib/settings";
import { getProfile } from "@/lib/auth";
import { dict } from "@/lib/i18n";
import { logAnnouncement, postCommunityMessage, saveCommunityIntro, inviteParentsToCommunity } from "./actions";

export const dynamic = "force-dynamic";

export default async function AnnouncePage({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string; error?: string; intro?: string; invited?: string; parents?: string }>;
}) {
  const { posted, error, intro: introSaved, invited, parents } = await searchParams;
  const botReady = !!env.waCommunityGroupId;
  const me = await getProfile();
  const L = dict(me?.locale);
  const isSuper = me?.role === "super_admin";
  const intro = await getCommunityIntro();
  const supabase = await createClient();
  const { data: history } = await supabase
    .from("messages")
    .select("id, body, status, created_at")
    .eq("type", "custom")
    .eq("recipient_phone", "community")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="space-y-6">
      <PageHeader
        title={L.an_title}
        description={L.an_desc}
      />

      {posted === "1" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {L.an_sent_now}
        </div>
      )}
      {posted === "queued" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {L.an_queued}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {introSaved === "saved" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{L.an_note_saved}</div>
      )}
      {introSaved === "cleared" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{L.an_note_cleared}</div>
      )}
      {invited !== undefined && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {L.an_invited.replace("{n}", invited).replace("{total}", parents ?? "?")}
        </div>
      )}

      {/* Super-admin only: push all parents an invite to the WhatsApp group. */}
      {isSuper && env.waCommunityLink && (
        <Section
          title={L.an_invite_title}
          description={L.an_invite_desc}
        >
          <form>
            <button type="submit" formAction={inviteParentsToCommunity} className={buttonClass("primary")}>
              📢 {L.an_push_invite}
            </button>
            <p className="mt-2 text-xs text-slate-500">
              {L.an_invite_note}
            </p>
          </form>
        </Section>
      )}
      {isSuper && !env.waCommunityLink && (
        <Section title={L.an_invite_title}>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {L.an_wa_link_hint}
          </p>
        </Section>
      )}

      {env.waCommunityLink && (
        <a
          href="/community-poster"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
        >
          🖨️ {L.an_print_poster}
        </a>
      )}

      {botReady ? (
        <Section
          title={L.an_msg_community}
          description={L.an_msg_desc}
        >
          <form className="space-y-3">
            <Textarea name="text" rows={4} placeholder={L.an_type_msg} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" formAction={postCommunityMessage} className={buttonClass("primary")}>{L.an_send_now}</button>
              <button type="submit" formAction={saveCommunityIntro} className={buttonClass("secondary")}>{L.an_save_note}</button>
            </div>
            <p className="text-xs text-slate-500">
              {L.an_send_note}
            </p>
          </form>
          <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
            {intro ? (
              <span className="text-slate-600">📌 {L.an_monthly_note}<span className="text-slate-900">&ldquo;{intro}&rdquo;</span></span>
            ) : (
              <span className="text-slate-400">{L.an_no_note}</span>
            )}
          </div>
        </Section>
      ) : (
        <Section title={L.an_msg_community}>
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {L.an_autopost_hint}
          </p>
          <AnnounceComposer action={logAnnouncement} communityLink={env.waCommunityLink || null} />
        </Section>
      )}

      <Section title={`${L.an_recent} (${history?.length ?? 0})`} flush>
        {history && history.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>{L.an_when}</Th>
                <Th>{L.an_message}</Th>
                <Th>{L.col_status}</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap text-slate-500">{formatDateTime(m.created_at)}</Td>
                  <Td label={L.an_message} className="max-w-lg whitespace-pre-wrap text-slate-700">{m.body}</Td>
                  <Td label={L.col_status}>
                    <Badge tone="green">{m.status}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="p-5">
            <EmptyState message={L.an_empty} />
          </div>
        )}
      </Section>
    </div>
  );
}
