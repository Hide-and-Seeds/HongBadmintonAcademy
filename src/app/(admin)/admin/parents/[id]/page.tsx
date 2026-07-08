import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { PageHeader, Section, Badge, EmptyState, Select, cn } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmButton } from "@/components/confirm-button";
import { levelBadgeClass, levelName } from "@/lib/training";
import { dict } from "@/lib/i18n";
import { PersonForm } from "../../_people/person-form";
import {
  updatePerson,
  unlinkChild,
  linkChild,
  generateParentLoginLink,
  sendParentPasswordReset,
} from "../../_people/actions";
import { LoginLinkPanel } from "./login-link-panel";

export const dynamic = "force-dynamic";

export default async function EditParentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    link?: string;
    wa?: string;
  }>;
}) {
  const { id } = await params;
  const { error, saved, link, wa } = await searchParams;
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const supabase = await createClient();
  const [{ data: person }, { data: children }, { data: unlinked }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("students").select("id, full_name, status, level").eq("parent_id", id).order("full_name"),
    // Students with no parent yet — RLS keeps a branch-admin to their branch.
    supabase.from("students").select("id, full_name").is("parent_id", null).eq("status", "active").order("full_name").limit(100),
  ]);
  if (!person) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={L.pd_edit_title} description={person.full_name ?? undefined} />

      {saved && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {saved}
        </p>
      )}

      <Section
        title={L.pd_signin}
        description={L.pd_signin_desc}
      >
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            <form action={sendParentPasswordReset}>
              <input type="hidden" name="parent_id" value={id} />
              <SubmitButton pendingText="…">{L.pd_send_reset}</SubmitButton>
            </form>
            <form action={generateParentLoginLink}>
              <input type="hidden" name="parent_id" value={id} />
              <SubmitButton variant="secondary" pendingText={L.inv_generating}>{L.pd_gen_link}</SubmitButton>
            </form>
          </div>

          {link && <LoginLinkPanel link={link} wa={wa ?? null} />}
        </div>
      </Section>

      <Section title={`${L.pd_children} (${children?.length ?? 0})`} flush>
        {children && children.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {children.map((c: any) => {
              const lvl = Number(c.level ?? 1);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                  <Link href={`/admin/students/${c.id}`} className="flex min-w-0 items-center gap-2">
                    <span className="font-medium text-slate-900">{c.full_name}</span>
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", levelBadgeClass(lvl))}>L{lvl} · {levelName(lvl)}</span>
                  </Link>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Badge tone={c.status === "active" ? "green" : "slate"}>{c.status === "active" ? L.adm_active : L.adm_inactive}</Badge>
                    <form action={unlinkChild}>
                      <input type="hidden" name="student_id" value={c.id} />
                      <input type="hidden" name="parent_id" value={id} />
                      <ConfirmButton label={L.pd_unlink} confirmText={L.pd_unlink_confirm.replace("{name}", c.full_name)} />
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-5"><EmptyState message={L.pd_no_children} /></div>
        )}
        {unlinked && unlinked.length > 0 && (
          <form action={linkChild} className="flex flex-wrap items-end gap-2 border-t border-slate-100 p-5">
            <input type="hidden" name="parent_id" value={id} />
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">{L.pd_link_label}</span>
              <Select name="student_id" required className="h-9 w-64">
                <option value="">{L.pd_pick_student}</option>
                {unlinked.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </Select>
            </label>
            <SubmitButton pendingText="…">{L.pd_link_btn}</SubmitButton>
          </form>
        )}
      </Section>

      <PersonForm
        role="parent"
        person={person}
        action={updatePerson.bind(null, "parent")}
        error={error}
        locale={me.locale}
      />
    </div>
  );
}
