import { requireRole } from "@/lib/auth";
import { PageHeader, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ROLE_LABEL } from "@/lib/constants";
import { updateOwnProfile } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const profile = await requireRole("admin");
  const { error, saved } = await searchParams;

  return (
    <div>
      <PageHeader title="Account Settings" description="Edit your own profile details." />

      <Card className="max-w-xl p-6">
        {saved && <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">Saved.</p>}
        {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <form action={updateOwnProfile} className="space-y-4">
          <Field label="Full name" required>
            <Input name="full_name" defaultValue={profile.full_name ?? ""} required />
          </Field>

          <Field label="Email" hint="Email can't be changed here.">
            <Input
              defaultValue={profile.email ?? ""}
              readOnly
              className="bg-slate-50 text-slate-500"
            />
          </Field>

          <Field label="Role">
            <Input defaultValue={ROLE_LABEL[profile.role] ?? profile.role} readOnly className="bg-slate-50 text-slate-500" />
          </Field>

          <Field label="Phone (WhatsApp)" hint="E.164 format, e.g. +60123456789">
            <Input name="phone" defaultValue={profile.phone ?? ""} placeholder="+60…" />
          </Field>

          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
