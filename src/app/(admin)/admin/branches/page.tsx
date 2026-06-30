import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  PageHeader, Card, Section, Field, Input, Badge, EmptyState, cn,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmButton } from "@/components/confirm-button";
import { createBranch, updateBranch, toggleBranch, deleteBranch } from "./actions";

export const dynamic = "force-dynamic";

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireSuperAdmin();
  const { error, saved } = await searchParams;
  const supabase = await createClient();

  const [{ data: branches }, { data: students }, { data: classes }, { data: staff }] =
    await Promise.all([
      supabase.from("branches").select("*").order("name"),
      supabase.from("students").select("branch_id"),
      supabase.from("classes").select("branch_id"),
      supabase.from("profiles").select("branch_id, role"),
    ]);

  const tally = (rows: { branch_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.branch_id) m.set(r.branch_id, (m.get(r.branch_id) ?? 0) + 1);
    return m;
  };
  const stCount = tally(students);
  const clCount = tally(classes);
  const staffCount = tally((staff ?? []).filter((p: any) => p.role !== "parent"));

  return (
    <div className="space-y-6">
      <PageHeader title="Branches" description="Locations across the academy. Students, classes, staff and invoices each belong to one branch." />

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">Saved.</p>}

      <Card className="max-w-2xl p-6">
        <form action={createBranch} className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Add a branch</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Branch name" required>
              <Input name="name" required placeholder="e.g. Petaling Jaya" />
            </Field>
            <Field label="Short code" hint="Optional, e.g. PJ.">
              <Input name="code" placeholder="PJ" />
            </Field>
            <Field label="Phone">
              <Input name="phone" placeholder="+60…" />
            </Field>
            <Field label="Address">
              <Input name="address" />
            </Field>
          </div>
          <SubmitButton pendingText="Adding…">Add branch</SubmitButton>
        </form>
      </Card>

      <Section title={`All branches (${branches?.length ?? 0})`} flush>
        {branches && branches.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {branches.map((b: any) => (
              <li key={b.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{b.name}</span>
                      {b.code && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">{b.code}</span>}
                      <Badge tone={b.is_active ? "green" : "slate"}>{b.is_active ? "active" : "inactive"}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {stCount.get(b.id) ?? 0} students · {clCount.get(b.id) ?? 0} classes · {staffCount.get(b.id) ?? 0} staff
                      {b.phone ? ` · ${b.phone}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={toggleBranch}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="active" value={(!b.is_active).toString()} />
                      <SubmitButton variant="secondary" pendingText="…">{b.is_active ? "Deactivate" : "Activate"}</SubmitButton>
                    </form>
                    <form action={deleteBranch}>
                      <input type="hidden" name="id" value={b.id} />
                      <ConfirmButton label="Delete" confirmText={`Delete branch "${b.name}"? Only works if it has no members.`} />
                    </form>
                  </div>
                </div>

                <details className="mt-3">
                  <summary className={cn("cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-700")}>Edit details</summary>
                  <form action={updateBranch} className="mt-3 grid max-w-2xl gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={b.id} />
                    <Field label="Name" required>
                      <Input name="name" defaultValue={b.name} required />
                    </Field>
                    <Field label="Short code">
                      <Input name="code" defaultValue={b.code ?? ""} />
                    </Field>
                    <Field label="Phone">
                      <Input name="phone" defaultValue={b.phone ?? ""} />
                    </Field>
                    <Field label="Address">
                      <Input name="address" defaultValue={b.address ?? ""} />
                    </Field>
                    <div className="sm:col-span-2">
                      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
                    </div>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5"><EmptyState message="No branches yet — add your first above." /></div>
        )}
      </Section>
    </div>
  );
}
