import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getViewBranchId } from "@/lib/branch";
import { PageHeader, Section, LinkButton, Table, Th, Td, Badge, EmptyState, cn } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { BulkProvider, BulkSelectAll, BulkCheckbox, BulkBar } from "@/components/bulk-select";
import { FilterSelect, FilterSearch } from "@/components/filter-controls";
import { CLASS_RANKS, rankBadgeClass } from "@/lib/ranks";
import { dict } from "@/lib/i18n";
import { deleteClass, deleteClasses } from "./actions";

export const dynamic = "force-dynamic";

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rank?: string; active?: string; coach?: string }>;
}) {
  const { q, rank, active, coach } = await searchParams;
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const supabase = await createClient();
  const bf = await getViewBranchId(me);
  const { data: coaches } = await supabase.from("profiles").select("id, full_name").eq("role", "coach").order("full_name");
  const coachFilter = coach && (coaches ?? []).some((c) => c.id === coach) ? coach : "";

  let classQuery = supabase
    .from("classes")
    .select("*, coach:profiles!classes_coach_id_fkey(full_name), enrollments(count)")
    .order("name");
  if (bf) classQuery = classQuery.eq("branch_id", bf);
  if (coachFilter) classQuery = classQuery.eq("coach_id", coachFilter);
  const { data: classes } = await classQuery;

  const search = (q ?? "").trim().toLowerCase();
  const rankFilter = rank && (CLASS_RANKS as readonly string[]).includes(rank) ? rank : "";
  const activeFilter = active === "active" || active === "inactive" ? active : "";
  const filtered = Boolean(search || rankFilter || activeFilter || coachFilter);

  const rows = (classes ?? []).filter((c: any) => {
    if (search && !c.name.toLowerCase().includes(search)) return false;
    if (rankFilter && c.level !== rankFilter) return false;
    if (activeFilter === "active" && !c.is_active) return false;
    if (activeFilter === "inactive" && c.is_active) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title={L.cls_title}
        description={L.cls_desc}
        action={<LinkButton href="/admin/classes/new">{L.cls_new}</LinkButton>}
      />

      {/* Filters (auto-apply, soft navigation) */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-600">{L.adm_search}</span>
          <FilterSearch name="q" defaultValue={q ?? ""} placeholder={L.cls_name_ph} className="h-9 w-48" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-600">{L.level_word}</span>
          <FilterSelect name="rank" defaultValue={rankFilter} className="h-9 w-44">
            <option value="">{L.cls_all_levels}</option>
            {CLASS_RANKS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </FilterSelect>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-600">{L.col_status}</span>
          <FilterSelect name="active" defaultValue={activeFilter} className="h-9 w-36">
            <option value="">{L.filter_all}</option>
            <option value="active">{L.adm_active}</option>
            <option value="inactive">{L.adm_inactive}</option>
          </FilterSelect>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-600">{L.adm_coach}</span>
          <FilterSelect name="coach" defaultValue={coachFilter} className="h-9 w-44">
            <option value="">{L.adm_all_coaches}</option>
            {(coaches ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.full_name ?? c.id}</option>
            ))}
          </FilterSelect>
        </label>
        {filtered && <LinkButton href="/admin/classes" variant="ghost">{L.clear_word}</LinkButton>}
      </div>

      {rows.length > 0 ? (
        <Section title={`${filtered ? L.cls_section_filtered : L.cls_section} (${rows.length})`} flush>
          <BulkProvider>
          <Table>
            <thead>
              <tr>
                <Th className="w-10"><BulkSelectAll /></Th>
                <Th>{L.col_name}</Th>
                <Th>{L.level_word}</Th>
                <Th>{L.cls_primary_coach}</Th>
                <Th>{L.cls_students}</Th>
                <Th>{L.cls_active_col}</Th>
                <Th className="text-right">{L.col_actions}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td><BulkCheckbox id={c.id} /></Td>
                  <Td className="font-medium text-slate-900">{c.name}</Td>
                  <Td label={L.level_word}>
                    {c.level ? (
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", rankBadgeClass(c.level))}>
                        {c.level}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="text-slate-500">{c.coach?.full_name ?? "—"}</Td>
                  <Td className="tabular-nums">{c.enrollments?.[0]?.count ?? 0}</Td>
                  <Td>
                    <Badge tone={c.is_active ? "green" : "slate"}>
                      {c.is_active ? L.adm_active : L.adm_inactive}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <LinkButton href={`/admin/classes/${c.id}`} variant="secondary">
                        {L.cls_manage}
                      </LinkButton>
                      <form action={deleteClass}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmButton confirmText={L.cls_delete_confirm.replace("{name}", c.name)} />
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="px-5 pb-5">
            <BulkBar
              action={deleteClasses}
              label={L.cls_word}
              confirmText={L.cls_bulk_delete}
              locale={me.locale}
            />
          </div>
          </BulkProvider>
        </Section>
      ) : (
        <EmptyState message={filtered ? L.cls_empty_filtered : L.cls_empty} />
      )}
    </div>
  );
}
