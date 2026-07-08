import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { PageHeader, Section, LinkButton, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { dict } from "@/lib/i18n";
import { deleteRewardRule } from "./actions";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const supabase = await createClient();
  const { data: rules } = await supabase.from("reward_rules").select("*").order("name");

  return (
    <div>
      <PageHeader
        title={L.rw_title}
        description={L.rw_desc}
        action={<LinkButton href="/admin/rewards/new">{L.rw_new}</LinkButton>}
      />

      {rules && rules.length > 0 ? (
        <Section title={`${L.rw_section} (${rules.length})`} flush>
          <Table>
            <thead>
              <tr>
                <Th>{L.col_name}</Th>
                <Th>{L.rw_points}</Th>
                <Th>{L.cls_active_col}</Th>
                <Th className="text-right">{L.col_actions}</Th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{r.name}</Td>
                  <Td label={L.rw_points}><Badge tone="green">+{r.points}</Badge></Td>
                  <Td label={L.cls_active_col}>
                    <Badge tone={r.is_active ? "green" : "slate"}>
                      {r.is_active ? L.adm_active : L.adm_inactive}
                    </Badge>
                  </Td>
                  <Td label={L.col_actions} className="text-right">
                    <div className="flex justify-end gap-2">
                      <LinkButton href={`/admin/rewards/${r.id}`} variant="secondary">
                        {L.edit_btn}
                      </LinkButton>
                      <form action={deleteRewardRule}>
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmButton confirmText={L.rw_delete_confirm.replace("{name}", r.name)} />
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      ) : (
        <EmptyState message={L.rw_empty} />
      )}
    </div>
  );
}
