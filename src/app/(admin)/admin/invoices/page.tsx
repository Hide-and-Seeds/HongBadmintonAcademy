import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getViewBranchId } from "@/lib/branch";
import { PageHeader, Collapsible, LinkButton, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { FilterSelect, FilterSearch } from "@/components/filter-controls";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmButton } from "@/components/confirm-button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { formatCurrency, formatDate, formatDateTime, monthLabel } from "@/lib/format";
import { getBaseUrl } from "@/lib/url";
import { getMonthlySchedule } from "@/lib/settings";
import { waLink } from "@/lib/wa";
import { feeReminderText } from "@/lib/reminder-text";
import { dict } from "@/lib/i18n";
import type { InvoiceStatus } from "@/lib/types";
import { markPaid, cancelInvoice, refundInvoice, deleteInvoice, logReminderSend, generateMonthlyInvoices } from "./actions";

export const dynamic = "force-dynamic";

const TONE: Record<InvoiceStatus, "green" | "yellow" | "red" | "slate"> = {
  draft: "slate", unpaid: "yellow", paid: "green", overdue: "red",
  canceled: "slate", refunded: "slate",
};

const STATUSES: InvoiceStatus[] = ["draft", "unpaid", "paid", "overdue", "canceled", "refunded"];

// Ordinal suffix for "due on the 7th" copy.
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ generated?: string; notice?: string; status?: string; month?: string; q?: string; refunded?: string; error?: string }>;
}) {
  const { generated, notice, status, month, q, refunded, error } = await searchParams;
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const isSuper = me.role === "super_admin";
  const supabase = await createClient();
  const bf = await getViewBranchId(me);
  const baseUrl = await getBaseUrl();
  const schedule = await getMonthlySchedule();
  // English uses an ordinal ("7th"); Chinese uses a bare day number ("7号").
  const dueStr = me.locale === "zh" ? String(schedule.dueDay) : ordinal(schedule.dueDay);
  const invStatus: Record<string, string> = {
    draft: L.inv_st_draft, unpaid: L.inv_st_unpaid, paid: L.inv_st_paid,
    overdue: L.inv_st_overdue, canceled: L.inv_st_canceled, refunded: L.inv_st_refunded,
  };
  const payStatus: Record<string, string> = {
    succeeded: L.inv_pay_succeeded, failed: L.inv_pay_failed, pending: L.inv_pay_pending,
  };

  // Branch admins are limited to follow-ups (unpaid + overdue) — no paid history
  // or revenue; super-admins see every status.
  const allowedStatuses: InvoiceStatus[] = isSuper ? STATUSES : (["unpaid", "overdue"] as InvoiceStatus[]);
  const statusFilter = status && (allowedStatuses as string[]).includes(status) ? status : "";
  const monthFilter = month && /^\d{4}-\d{2}-\d{2}$/.test(month) ? month : "";
  const search = (q ?? "").trim().toLowerCase();

  let invQuery = supabase
    .from("invoices")
    .select("*, students(full_name), parent:profiles!invoices_parent_id_fkey(full_name, phone, id)")
    .order("created_at", { ascending: false });
  if (statusFilter) invQuery = invQuery.eq("status", statusFilter);
  if (monthFilter) invQuery = invQuery.eq("period_month", monthFilter);
  if (bf) invQuery = invQuery.eq("branch_id", bf);
  if (!isSuper) invQuery = invQuery.in("status", ["unpaid", "overdue"]);

  const [{ data: rawInvoices }, { data: payments }, { data: monthRows }] = await Promise.all([
    invQuery,
    supabase
      .from("payments")
      .select("*, invoices(invoice_no)")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("invoices").select("period_month").not("period_month", "is", null),
  ]);

  // Distinct billing months for the dropdown (newest first).
  const monthOptions = [...new Set((monthRows ?? []).map((r: any) => r.period_month as string))].sort().reverse();

  // Search by invoice number OR student/parent name (in-memory — Supabase can't
  // ILIKE across embedded relations).
  const invoices = search
    ? (rawInvoices ?? []).filter((i: any) =>
        `${i.invoice_no ?? ""} ${i.students?.full_name ?? ""} ${i.parent?.full_name ?? ""}`.toLowerCase().includes(search),
      )
    : rawInvoices ?? [];

  const filtered = Boolean(statusFilter || monthFilter || search);

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title={isSuper ? L.inv_title_super : L.inv_title_branch}
          description={(isSuper ? L.inv_desc_super : L.inv_desc_branch).replace("{d}", dueStr)}
          action={
            <>
              <form action={generateMonthlyInvoices}>
                <SubmitButton variant="secondary" pendingText={L.inv_generating}>{L.inv_generate}</SubmitButton>
              </form>
              <LinkButton href="/admin/invoices/new">{L.inv_new}</LinkButton>
            </>
          }
        />

        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {refunded && (
          <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {refunded === "stripe" ? L.inv_refund_stripe : L.inv_refund_manual}
          </p>
        )}

        {generated !== undefined && (() => {
          const n = Number(generated);
          const map: Record<string, { tone: string; msg: string }> = {
            sent: { tone: "border-green-200 bg-green-50 text-green-800", msg: L.inv_notice_sent },
            queued: { tone: "border-green-200 bg-green-50 text-green-800", msg: L.inv_notice_queued },
            updated: { tone: "border-green-200 bg-green-50 text-green-800", msg: L.inv_notice_updated },
            "already-sent": { tone: "border-blue-200 bg-blue-50 text-blue-800", msg: L.inv_notice_already },
            skipped: { tone: "border-slate-200 bg-slate-50 text-slate-700", msg: "" },
            "no-group-id": { tone: "border-amber-200 bg-amber-50 text-amber-800", msg: L.inv_notice_no_group },
          };
          const m = map[notice ?? ""] ?? { tone: "border-slate-200 bg-slate-50 text-slate-700", msg: "" };
          return (
            <div className={`mb-5 rounded-xl border p-4 text-sm ${m.tone}`}>
              <strong>{L.inv_raised.replace("{n}", String(n))}</strong> {m.msg}
            </div>
          );
        })()}

        {/* Filters (auto-apply, soft navigation) */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">{L.col_status}</span>
            <FilterSelect name="status" defaultValue={statusFilter} className="h-9 w-40">
              <option value="">{L.inv_all_statuses}</option>
              {allowedStatuses.map((s) => (
                <option key={s} value={s}>{invStatus[s] ?? s}</option>
              ))}
            </FilterSelect>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">{L.inv_month_label}</span>
            <FilterSelect name="month" defaultValue={monthFilter} className="h-9 w-44">
              <option value="">{L.inv_all_months}</option>
              {monthOptions.map((mo) => (
                <option key={mo} value={mo}>{monthLabel(mo)}</option>
              ))}
            </FilterSelect>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">{L.adm_search}</span>
            <FilterSearch name="q" defaultValue={q ?? ""} placeholder={L.inv_search_ph} className="h-9 w-52" />
          </label>
          {filtered && (
            <LinkButton href="/admin/invoices" variant="ghost">{L.clear_word}</LinkButton>
          )}
        </div>

        {invoices && invoices.length > 0 ? (
          <Collapsible title={filtered ? L.inv_section_filtered : L.inv_section} count={invoices.length}>
            <Table>
              <thead>
                <tr>
                  <Th>{L.inv_invoice}</Th><Th>{L.student_col}</Th><Th>{L.inv_parent}</Th><Th>{L.fp_amount}</Th>
                  <Th>{L.inv_due}</Th><Th>{L.col_status}</Th><Th className="text-right">{L.col_actions}</Th>
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
                      <Td label={L.student_col} className="font-medium text-slate-900">{i.students?.full_name ?? "—"}</Td>
                      <Td label={L.inv_parent} className="text-slate-500">{i.parent?.full_name ?? "—"}</Td>
                      <Td label={L.fp_amount} className="font-medium text-slate-900">{formatCurrency(Number(i.amount), i.currency)}</Td>
                      <Td label={L.inv_due} className="text-slate-500">{formatDate(i.due_date)}</Td>
                      <Td label={L.col_status}><Badge tone={TONE[i.status as InvoiceStatus]}>{invStatus[i.status] ?? i.status}</Badge></Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-2">
                          <a
                            href={`/api/invoices/${i.id}/pdf`}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            PDF
                          </a>
                          {i.status !== "paid" && (
                            <form action={markPaid}>
                              <input type="hidden" name="id" value={i.id} />
                              <SubmitButton variant="secondary" pendingText={L.cr_saving}>{L.inv_mark_paid}</SubmitButton>
                            </form>
                          )}
                          {payable && (
                            <WhatsAppButton
                              waUrl={waUrl}
                              action={logReminderSend}
                              label={L.inv_remind}
                              fields={{
                                invoice_id: i.id,
                                recipient_phone: i.parent?.phone ?? "",
                                recipient_profile_id: i.parent?.id ?? "",
                                body: text,
                              }}
                            />
                          )}
                          {payable && (
                            <form action={cancelInvoice}>
                              <input type="hidden" name="id" value={i.id} />
                              <ConfirmButton label={L.inv_cancel_label} confirmText={L.inv_cancel_confirm} />
                            </form>
                          )}
                          {i.status === "paid" && (
                            <form action={refundInvoice}>
                              <input type="hidden" name="id" value={i.id} />
                              <ConfirmButton
                                label={L.inv_refund_label}
                                confirmText={i.stripe_payment_intent_id ? L.inv_refund_confirm_stripe : L.inv_refund_confirm_manual}
                              />
                            </form>
                          )}
                          <form action={deleteInvoice}>
                            <input type="hidden" name="id" value={i.id} />
                            <ConfirmButton confirmText={L.inv_delete_confirm} />
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
          <EmptyState message={filtered ? L.inv_empty_filtered : L.inv_empty} />
        )}
      </div>

      {isSuper && (
      <Collapsible title={L.inv_recent_pay} count={payments?.length ?? 0}>
        {payments && payments.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>{L.col_date}</Th><Th>{L.inv_invoice}</Th><Th>{L.fp_amount}</Th><Th>{L.inv_provider}</Th><Th>{L.col_status}</Th>
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
                      {payStatus[p.status] ?? p.status}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="p-5"><EmptyState message={L.inv_empty_pay} /></div>
        )}
      </Collapsible>
      )}
    </div>
  );
}
