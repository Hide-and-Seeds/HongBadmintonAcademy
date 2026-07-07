import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ClubMemberForm } from "../club-member-form";
import { createClubMember } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewClubMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSuperAdmin();
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: tiers } = await supabase
    .from("fee_plans")
    .select("id, name, amount, currency")
    .eq("business", "club")
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <PageHeader title="Add club member" description="Register a club member and assign a membership tier." />
      <ClubMemberForm action={createClubMember} tiers={tiers ?? []} error={error} />
    </div>
  );
}
