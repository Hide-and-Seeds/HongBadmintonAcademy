import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { dict } from "@/lib/i18n";
import { PersonForm } from "../../../_people/person-form";
import { updateStaff, resetStaffTwoFactor } from "../../../_people/actions";

export const dynamic = "force-dynamic";

export default async function EditStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requireSuperAdmin();
  const L = dict(me.locale);
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: person } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  // Staff page manages admins only. Coaches live under /admin/coaches.
  if (!person || (person.role !== "admin" && person.role !== "super_admin")) notFound();

  return (
    <div>
      <PageHeader title={L.pf_edit_staff} description={person.full_name ?? person.email ?? undefined} />
      <PersonForm
        role={person.role}
        person={person}
        action={updateStaff}
        roleOptions={[
          { value: "admin", label: L.pf_role_branch_admin },
          { value: "super_admin", label: L.pf_role_super },
        ]}
        allowEmailEdit
        cancelHref="/admin/staff"
        submitLabel={L.br_save_changes}
        error={error}
        locale={me.locale}
      />

      <Section title={L.two_factor} description={L.st2fa_desc}>
        <div className="p-5">
          <form action={resetStaffTwoFactor}>
            <input type="hidden" name="id" value={id} />
            <ConfirmButton label={L.st2fa_reset} variant="secondary" confirmText={L.st2fa_confirm} />
          </form>
        </div>
      </Section>
    </div>
  );
}
