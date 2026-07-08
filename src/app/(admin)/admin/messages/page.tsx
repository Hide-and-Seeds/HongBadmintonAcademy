import { CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { PageHeader, Collapsible, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { dict } from "@/lib/i18n";
import type { MessageStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const TONE: Record<MessageStatus, "green" | "blue" | "yellow" | "red" | "slate"> = {
  queued: "slate", sent: "blue", delivered: "green", read: "green", failed: "red",
};

export default async function MessagesPage() {
  const me = await requireRole("admin");
  const L = dict(me.locale);
  // Friendly labels for message_queue.kind values.
  const kindLabel = (k: string): string =>
    k === "before_due" ? L.msg_kind_before
      : k === "due_day" ? L.msg_kind_due
      : k === "session_canceled" ? L.msg_kind_cancel
      : k.startsWith("overdue_") ? L.msg_kind_overdue.replace("{d}", k.slice(8))
      : k;
  const supabase = await createClient();
  // The pending queue lives in message_queue (server-only RLS) — read it with the
  // service-role client; the sent/failed log lives in messages.
  const admin = createAdminClient();

  const [{ data: queued }, { data: messages }] = await Promise.all([
    admin
      .from("message_queue")
      .select("*")
      .in("status", ["queued", "sending"])
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={L.msg_title} description={L.msg_desc} />

      <Collapsible title={L.msg_queued_title} count={queued?.length ?? 0}>
        {queued && queued.length > 0 ? (
          <Table>
            <thead>
              <tr><Th>{L.msg_queued_col}</Th><Th>{L.msg_type}</Th><Th>{L.msg_to}</Th><Th>{L.an_message}</Th></tr>
            </thead>
            <tbody>
              {queued.map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <Td className="text-slate-500">{formatDateTime(m.created_at)}</Td>
                  <Td label={L.msg_type}><Badge tone="slate">{kindLabel(m.kind)}</Badge></Td>
                  <Td label={L.msg_to} className="font-mono text-xs text-slate-500">{m.recipient_phone}</Td>
                  <Td label={L.an_message} className="max-w-md truncate text-xs text-slate-500" title={m.body ?? ""}>{m.body}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="p-5"><EmptyState icon={<CircleCheck className="h-5 w-5 text-green-500" />} message={L.msg_caught_up} hint={L.msg_nothing_queued} /></div>
        )}
      </Collapsible>

      <Collapsible title={L.msg_log_title} count={messages?.length ?? 0}>
        {messages && messages.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>{L.an_when}</Th><Th>{L.msg_type}</Th><Th>{L.msg_to}</Th><Th>{L.col_status}</Th><Th>{L.msg_detail}</Th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <Td className="text-slate-500">{formatDateTime(m.created_at)}</Td>
                  <Td label={L.msg_type}><Badge tone="slate">{m.type}</Badge></Td>
                  <Td label={L.msg_to} className="font-mono text-xs text-slate-500">{m.recipient_phone}</Td>
                  <Td label={L.col_status}><Badge tone={TONE[m.status as MessageStatus]}>{m.status}</Badge></Td>
                  <Td label={L.msg_detail} className="max-w-md truncate text-xs text-slate-500" title={m.error ?? m.body ?? ""}>
                    {m.error ? <span className="text-red-600">{m.error}</span> : m.body}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="p-5"><EmptyState message={L.msg_empty} /></div>
        )}
      </Collapsible>
    </div>
  );
}
