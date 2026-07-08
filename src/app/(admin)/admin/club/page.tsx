import Link from "next/link";
import { Users, CalendarClock, TrendingUp, Wallet, Tag, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";
import { getViewBranchId } from "@/lib/branch";
import { PageHeader, Section, LinkButton, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, formatCurrency } from "@/lib/format";
import { signClubToken } from "@/lib/club-auth";
import { getBaseUrl } from "@/lib/url";
import { computePots } from "@/lib/pots";
import { dict } from "@/lib/i18n";
import { deleteClubMember, raiseMemberInvoice, generateClubDuesNow } from "./actions";

export const dynamic = "force-dynamic";

function todayMYT(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export default async function ClubHubPage({
  searchParams,
}: {
  searchParams: Promise<{ raised?: string; dues?: string; error?: string }>;
}) {
  const me = await requireSuperAdmin();
  const L = dict(me.locale);
  const { raised, dues, error } = await searchParams;
  const supabase = await createClient();
  const branchId = await getViewBranchId(me);
  const [{ data: members }, pots, { count: upcomingBookings }] = await Promise.all([
    supabase
      .from("club_members")
      .select("id, full_name, email, phone, status, joined_at, tier:fee_plans!club_members_tier_id_fkey(name)")
      .order("full_name"),
    computePots(supabase, new Date(), branchId),
    supabase
      .from("court_bookings")
      .select("id", { count: "exact", head: true })
      .gte("booking_date", todayMYT())
      .neq("status", "canceled"),
  ]);
  const baseUrl = await getBaseUrl();
  const memberRows = members ?? [];
  const activeCount = memberRows.filter((m: any) => m.status === "active").length;
  const pendingCount = memberRows.filter((m: any) => m.status === "pending").length;

  const TILES = [
    { label: L.club_active_members, value: String(activeCount), sub: pendingCount ? L.club_pending_sub.replace("{n}", String(pendingCount)) : L.club_members_sub, Icon: Users },
    { label: L.club_revenue, value: formatCurrency(pots.club.collected, "MYR"), sub: `${L.club_collected_sub} · ${pots.monthLabel}`, Icon: TrendingUp },
    { label: L.pot_available, value: formatCurrency(pots.club.available, "MYR"), sub: L.club_pot_sub, Icon: Wallet },
    { label: L.club_upcoming, value: String(upcomingBookings ?? 0), sub: L.club_courts_sub, Icon: CalendarClock },
  ];
  const LINKS = [
    { href: "/admin/club/bookings", label: L.club_bookings, desc: L.club_bookings_desc, Icon: CalendarClock },
    { href: "/admin/pots", label: L.club_revenue_pl, desc: L.club_revenue_pl_desc, Icon: TrendingUp },
    { href: "/admin/fee-plans", label: L.club_tiers, desc: L.club_tiers_desc, Icon: Tag },
    { href: "/admin/court-rentals", label: L.club_court_costs, desc: L.club_court_costs_desc, Icon: Wallet },
    { href: "/club", label: L.club_signup_link, desc: L.club_signup_desc, Icon: ExternalLink, external: true },
  ];

  return (
    <div>
      <PageHeader
        title={L.club_title}
        description={L.club_desc}
        action={
          <>
            <a
              href="/club"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {L.club_public_signup} ↗
            </a>
            <LinkButton href="/admin/club/bookings" variant="secondary">{L.club_bookings}</LinkButton>
            <form action={generateClubDuesNow}>
              <SubmitButton variant="secondary" pendingText={L.inv_generating}>{L.club_gen_dues}</SubmitButton>
            </form>
            <LinkButton href="/admin/club/new">{L.club_add_member}</LinkButton>
          </>
        }
      />

      {raised && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {L.club_raised}
        </p>
      )}
      {dues !== undefined && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {L.club_dues.replace("{n}", dues)}
        </p>
      )}
      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {/* Overview tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <t.Icon className="h-3.5 w-3.5" />{t.label}
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{t.value}</div>
            <div className="text-xs text-slate-400">{t.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick links to every club area */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {LINKS.map((l) =>
          l.external ? (
            <a key={l.href} href={l.href} target="_blank" rel="noopener" className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/40">
              <l.Icon className="h-5 w-5 text-emerald-600" />
              <div className="mt-2 text-sm font-semibold text-slate-900">{l.label} ↗</div>
              <div className="text-xs text-slate-400">{l.desc}</div>
            </a>
          ) : (
            <Link key={l.href} href={l.href} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/40">
              <l.Icon className="h-5 w-5 text-emerald-600" />
              <div className="mt-2 text-sm font-semibold text-slate-900">{l.label}</div>
              <div className="text-xs text-slate-400">{l.desc}</div>
            </Link>
          ),
        )}
      </div>

      {members && members.length > 0 ? (
        <Section title={`${L.club_members_section} (${members.length})`} flush>
          <Table>
            <thead>
              <tr>
                <Th>{L.col_name}</Th>
                <Th>{L.club_tier}</Th>
                <Th>{L.club_contact}</Th>
                <Th>{L.col_status}</Th>
                <Th>{L.club_joined}</Th>
                <Th className="text-right">{L.col_actions}</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{m.full_name}</Td>
                  <Td label={L.club_tier}>{m.tier?.name ?? <span className="text-slate-400">{L.none}</span>}</Td>
                  <Td label={L.club_contact} className="text-slate-500">{m.email || m.phone || "—"}</Td>
                  <Td label={L.col_status}>
                    <Badge tone={m.status === "active" ? "green" : m.status === "pending" ? "yellow" : "slate"}>{m.status === "active" ? L.adm_active : m.status === "pending" ? L.lv_st_pending : L.adm_inactive}</Badge>
                  </Td>
                  <Td label={L.club_joined} className="text-slate-500">{m.joined_at ? formatDate(m.joined_at) : "—"}</Td>
                  <Td label={L.col_actions} className="text-right">
                    <div className="flex justify-end gap-2">
                      <a
                        href={`${baseUrl}/club/me/${signClubToken(m.id)}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        title={L.club_portal_title}
                      >
                        {L.club_portal} ↗
                      </a>
                      <form action={raiseMemberInvoice}>
                        <input type="hidden" name="id" value={m.id} />
                        <SubmitButton variant="secondary" pendingText={L.club_raising}>{L.club_raise_invoice}</SubmitButton>
                      </form>
                      <LinkButton href={`/admin/club/${m.id}`} variant="secondary">{L.edit_btn}</LinkButton>
                      <form action={deleteClubMember}>
                        <input type="hidden" name="id" value={m.id} />
                        <ConfirmButton confirmText={L.club_del_member.replace("{name}", m.full_name)} />
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      ) : (
        <EmptyState message={L.club_empty} />
      )}
    </div>
  );
}
