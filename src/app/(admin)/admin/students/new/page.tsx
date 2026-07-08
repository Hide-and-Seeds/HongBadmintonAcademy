import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { listBranches, canChooseBranch } from "@/lib/branch";
import { PageHeader } from "@/components/ui";
import { dict } from "@/lib/i18n";
import { StudentForm } from "../student-form";
import { createStudent } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const supabase = await createClient();
  const [{ data: parents }, { data: plans }, { data: coaches }, branches] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "parent").order("full_name"),
    supabase.from("fee_plans").select("id, name, amount, currency, interval, rank").eq("is_active", true).order("name"),
    supabase.from("profiles").select("id, full_name").eq("role", "coach").order("full_name"),
    listBranches(),
  ]);

  return (
    <div>
      <PageHeader title={L.sf_new_student_title} />
      <StudentForm
        action={createStudent}
        parents={parents ?? []}
        plans={plans ?? []}
        coaches={coaches ?? []}
        branches={branches}
        canChooseBranch={canChooseBranch(me)}
        defaultBranchId={me.branch_id}
        error={error}
        locale={me.locale}
      />
    </div>
  );
}
