import { requireSuperAdmin } from "@/lib/auth";
import { listBranches } from "@/lib/branch";
import { PageHeader } from "@/components/ui";
import { PersonForm } from "../../_people/person-form";
import { createStaff } from "../../_people/actions";

export const dynamic = "force-dynamic";

export default async function NewStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSuperAdmin();
  const { error } = await searchParams;
  const branches = await listBranches();

  return (
    <div>
      <PageHeader title="New staff" description="Create a branch admin, super admin or coach." />
      <PersonForm
        role="admin"
        action={createStaff}
        roleOptions={[
          { value: "admin", label: "Branch admin (one branch)" },
          { value: "super_admin", label: "Super admin (all branches)" },
          { value: "coach", label: "Coach" },
        ]}
        branches={branches}
        showBranch
        cancelHref="/admin/staff"
        submitLabel="Create staff"
        error={error}
      />
    </div>
  );
}
