import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listBranches } from "@/lib/branch";
import { PageHeader, Section } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
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
  await requireSuperAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: person }, branches] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    listBranches(),
  ]);
  if (!person || (person.role !== "admin" && person.role !== "super_admin" && person.role !== "coach")) notFound();

  return (
    <div>
      <PageHeader title="Edit staff" description={person.full_name ?? person.email ?? undefined} />
      <PersonForm
        role={person.role}
        person={person}
        action={updateStaff}
        roleOptions={[
          { value: "admin", label: "Branch admin (one branch)" },
          { value: "super_admin", label: "Super admin (all branches)" },
          { value: "coach", label: "Coach" },
        ]}
        branches={branches}
        showBranch
        allowEmailEdit
        cancelHref="/admin/staff"
        submitLabel="Save changes"
        error={error}
      />

      <Section title="Two-factor authentication" description="If this staff member lost their authenticator device, reset it — they'll set up 2FA again on next login.">
        <div className="p-5">
          <form action={resetStaffTwoFactor}>
            <input type="hidden" name="id" value={id} />
            <ConfirmButton label="Reset 2FA" variant="secondary" confirmText="Remove this staff member's 2FA? They'll sign in with just their password until they set it up again." />
          </form>
        </div>
      </Section>
    </div>
  );
}
