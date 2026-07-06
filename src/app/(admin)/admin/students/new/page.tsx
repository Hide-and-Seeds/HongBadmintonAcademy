import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { listBranches, canChooseBranch } from "@/lib/branch";
import { PageHeader } from "@/components/ui";
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
  const supabase = await createClient();
  const [{ data: parents }, { data: plans }, { data: coaches }, branches] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "parent").order("full_name"),
    supabase.from("fee_plans").select("id, name, amount, currency, interval, rank").eq("is_active", true).order("name"),
    supabase.from("profiles").select("id, full_name").eq("role", "coach").order("full_name"),
    listBranches(),
  ]);

  return (
    <div>
      <PageHeader title="New student" />
      <StudentForm
        action={createStudent}
        parents={parents ?? []}
        plans={plans ?? []}
        coaches={coaches ?? []}
        branches={branches}
        canChooseBranch={canChooseBranch(me)}
        defaultBranchId={me.branch_id}
        error={error}
      />
    </div>
  );
}
