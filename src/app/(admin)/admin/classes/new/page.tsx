import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { listBranches, canChooseBranch } from "@/lib/branch";
import { PageHeader } from "@/components/ui";
import { dict } from "@/lib/i18n";
import { ClassForm } from "../class-form";
import { createClass } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewClassPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const supabase = await createClient();
  const [{ data: coaches }, branches] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "coach").order("full_name"),
    listBranches(),
  ]);

  return (
    <div>
      <PageHeader title={L.cf_new_class_title} />
      <ClassForm
        action={createClass}
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
