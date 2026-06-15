import { createClient } from "@/lib/supabase/server";
import { PageHeader, Collapsible, LinkButton, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmButton } from "@/components/confirm-button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { getBaseUrl } from "@/lib/url";
import { waLink } from "@/lib/wa";
import { feeReminderText } from "@/lib/reminder-text";
import type { InvoiceStatus } from "@/lib/types";
import { markPaid, deleteInvoice, logReminderSend, generateMonthlyInvoices } from "./actions";

export const dynamic = "force-dynamic";

const TONE: Record<InvoiceStatus, "green" | "yellow" | "red" | "slate"> = {
  draft: "slate", unpaid: "yellow", paid: "green", overdue: "red",
  canceled: "slate", refunded: "slate",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ generated?: string; notice?: string }>;
}) {
  const { generated, notice } = await searchParams;
  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  const [{ data: invoices }, { data: payments }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, students(full_name), parent:profiles!invoices_parent_id_fkey(full_name, phone, id)")
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("*, invoices(invoice_no)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title="Invoices & Payments"
          description="Monthly fees auto-raise for students on a fee plan (1st of month). Reconcile payments; reminders drip-send automatically."
          action={
            <>
              <form action={generateMonthlyInvoices}>
                <SubmitButton variant="secondary" pendingText="Generating…">Generate this month</SubmitButton>
              </form>
              <LinkButton href="/admin/invoices/new">+ New invoice</LinkButton>
            </>
          }
        />

        {generated !== undefined && (() => {
          const n = Number(generated);
          const map: Record<string, { tone: string; msg: string }> = {
            queued: { tone: "border-green-200 bg-green-50 text-green-800", msg: "Community notice queued — worker will post the combined update to parents shortly." },
            updated: { tone: "border-green-200 bg-green-50 text-green-800", msg: "Combined Community notice (reports + fees) refreshed and queued." },
            "already-sent": { tone: "border-blue-200 bg-blue-50 text-blue-800", msg: "This month's Community notice was already posted — not duplicated." },
            skipped: { tone: "border-slate-200 bg-slate-50 text-slate-700", msg: "" },
            "no-group-id": { tone: "border-amber-200 bg-amber-50 text-amber-800", msg: "⚠️ Set WA_COMMUNITY_GROUP_ID in Vercel to auto-post the Community notice." },
          };
          const m = map[notice ?? ""] ?? { tone: "border-slate-200 bg-slate-50 text-slate-700", msg: "" };
          return (
            <div className={`mb-5 rounded-xl border p-4 text-sm ${m.tone}`}>
              <strong>Raised {n} invoice{n === 1 ? "" : "s"} for this month.</strong> {m.msg}
            </div>
          );
        })()}

        {invoices && invoices.length > 0 ? (
          <Collapsible title="Invoices" count={invoices.length}>
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th><Th>Student</Th><Th>Parent</Th><Th>Amount</Th>
                  <Th>Due</Th><Th>Status</Th><Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i: any) => {
                  const payable = i.status !== "paid" && i.status !== "canceled" && i.status !== "refunded";
                  const text = feeReminderText({
                    parentName: i.parent?.full_name,
                    studentName: i.students?.full_name,
                    amount: i.amount,
                    currency: i.currency,
                    dueDate: i.due_date,
                    payUrl: `${baseUrl}/parent/invoices`,
                  });
                  const waUrl = waLink(i.parent?.phone, text);
                  return (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <Td className="font-mono text-xs text-slate-500">{i.invoice_no ?? "—"}</Td>
                      <Td label="Student" className="font-medium text-slate-900">{i.students?.full_name ?? "—"}</Td>
                      <Td label="Parent" className="text-slate-500">{i.parent?.full_name ?? "—"}</Td>
                      <Td label="Amount" className="font-medium text-slate-900">{formatCurrency(Number(i.amount), i.currency)}</Td>
                      <Td label="Due" className="text-slate-500">{formatDate(i.due_date)}</Td>
                      <Td label="Status"><Badge tone={TONE[i.status as InvoiceStatus]}>{i.status}</Badge></Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-2">
                          {i.status !== "paid" && (
                            <form action={markPaid}>
                              <input type="hidden" name="id" value={i.id} />
                              <SubmitButton variant="secondary" pendingText="Saving…">Mark paid</SubmitButton>
                            </form>
                          )}
                          {payable && (
                            <WhatsAppButton
                              waUrl={waUrl}
                              action={logReminderSend}
                              label="Remind"
                              fields={{
                                invoice_id: i.id,
                                recipient_phone: i.parent?.phone ?? "",
                                recipient_profile_id: i.parent?.id ?? "",
                                body: text,
                              }}
                            />
                          )}
                          <form action={deleteInvoice}>
                            <input type="hidden" name="id" value={i.id} />
                            <ConfirmButton confirmText="Delete this invoice?" />
                          </form>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Collapsible>
        ) : (
          <EmptyState message="No invoices yet." />
        )}
      </div>

      <Collapsible title="Recent payments" count={payments?.length ?? 0}>
        {payments && payments.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th><Th>Invoice</Th><Th>Amount</Th><Th>Provider</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td className="text-slate-500">{formatDateTime(p.created_at)}</Td>
                  <Td className="font-mono text-xs text-slate-500">{p.invoices?.invoice_no ?? "—"}</Td>
                  <Td className="font-medium text-slate-900">{formatCurrency(Number(p.amount), p.currency)}</Td>
                  <Td className="capitalize text-slate-500">{p.provider}</Td>
                  <Td>
                    <Badge tone={p.status === "succeeded" ? "green" : p.status === "failed" ? "red" : "slate"}>
                      {p.status}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="p-5"><EmptyState message="No payments recorded yet." /></div>
        )}
      </Collapsible>
    </div>
  );
}
