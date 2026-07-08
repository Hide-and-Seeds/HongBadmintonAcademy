import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { listBranches, canChooseBranch } from "@/lib/branch";
import { PageHeader } from "@/components/ui";
import { dict } from "@/lib/i18n";
import { StudentForm } from "../../student-form";
import { updateStudent } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const supabase = await createClient();

  const [{ data: student }, { data: parents }, { data: plans }, { data: coaches }, branches] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("id, full_name").eq("role", "parent").order("full_name"),
    supabase.from("fee_plans").select("id, name, amount, currency, interval, rank").eq("is_active", true).order("name"),
    supabase.from("profiles").select("id, full_name").eq("role", "coach").order("full_name"),
    listBranches(),
  ]);

  if (!student) notFound();

  return (
    <div>
      <PageHeader title={L.sf_edit_student_title} description={student.full_name} />
      <StudentForm
        action={updateStudent}
        student={student}
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
