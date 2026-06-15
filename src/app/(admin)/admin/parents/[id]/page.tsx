import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section, Badge, EmptyState } from "@/components/ui";
import { PersonForm } from "../../_people/person-form";
import { updatePerson } from "../../_people/actions";

export const dynamic = "force-dynamic";

export default async function EditParentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: person }, { data: children }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("students").select("id, full_name, status").eq("parent_id", id).order("full_name"),
  ]);
  if (!person) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Edit parent" description={person.full_name ?? undefined} />

      <Section title={`Children (${children?.length ?? 0})`} flush>
        {children && children.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {children.map((c: any) => (
              <li key={c.id}>
                <Link href={`/admin/students/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <span className="font-medium text-slate-900">{c.full_name}</span>
                  <Badge tone={c.status === "active" ? "green" : "slate"}>{c.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5"><EmptyState message="No children linked to this parent yet." /></div>
        )}
      </Section>

      <PersonForm
        role="parent"
        person={person}
        action={updatePerson.bind(null, "parent")}
        error={error}
      />
    </div>
  );
}
