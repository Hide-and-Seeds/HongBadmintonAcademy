import { requireSuperAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { dict } from "@/lib/i18n";
import { PersonForm } from "../../_people/person-form";
import { createStaff } from "../../_people/actions";

export const dynamic = "force-dynamic";

export default async function NewStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requireSuperAdmin();
  const L = dict(me.locale);
  const { error } = await searchParams;

  return (
    <div>
      <PageHeader title={L.pf_new_staff} description={L.pf_new_staff_desc} />
      <PersonForm
        role="admin"
        action={createStaff}
        roleOptions={[
          { value: "admin", label: L.pf_role_branch_admin },
          { value: "super_admin", label: L.pf_role_super },
        ]}
        cancelHref="/admin/staff"
        submitLabel={L.pf_create_staff}
        error={error}
        locale={me.locale}
      />
    </div>
  );
}
