import { listBranches } from "@/lib/branch";
import { PageHeader } from "@/components/ui";
import { PersonForm } from "../../_people/person-form";
import { createPerson } from "../../_people/actions";

export const dynamic = "force-dynamic";

export default async function NewCoachPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const branches = await listBranches();
  return (
    <div>
      <PageHeader title="New coach" />
      <PersonForm role="coach" action={createPerson.bind(null, "coach")} branches={branches} showBranch error={error} />
    </div>
  );
}
