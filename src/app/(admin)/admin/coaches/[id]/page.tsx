import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section, Badge, EmptyState, LinkButton } from "@/components/ui";
import { PersonForm } from "../../_people/person-form";
import { updatePerson } from "../../_people/actions";

export const dynamic = "force-dynamic";

export default async function EditCoachPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: person }, { data: primary }, { data: cc }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("classes").select("id, name, is_active").eq("coach_id", id),
    supabase.from("class_coaches").select("classes(id, name, is_active)").eq("coach_id", id),
  ]);
  if (!person) notFound();

  // Merge primary-coach + co-coach classes, unique by id.
  const classMap = new Map<string, { id: string; name: string; is_active: boolean }>();
  for (const c of primary ?? []) classMap.set(c.id, c as any);
  for (const row of cc ?? []) {
    const c = (row as any).classes;
    if (c) classMap.set(c.id, c);
  }
  const classes = [...classMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit coach"
        description={person.full_name ?? undefined}
        action={<LinkButton href="/admin/coaches/summary" variant="ghost">Pay & attendance →</LinkButton>}
      />

      <Section title={`Classes (${classes.length})`} flush>
        {classes.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {classes.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/classes/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <span className="font-medium text-slate-900">{c.name}</span>
                  <Badge tone={c.is_active ? "green" : "slate"}>{c.is_active ? "active" : "inactive"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5"><EmptyState message="Not assigned to any classes yet." /></div>
        )}
      </Section>

      <PersonForm
        role="coach"
        person={person}
        action={updatePerson.bind(null, "coach")}
        error={error}
      />
    </div>
  );
}
