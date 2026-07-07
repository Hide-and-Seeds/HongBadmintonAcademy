import { Card, Field, Input, Select, Textarea, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type Tier = { id: string; name: string; amount: number; currency: string };
type Member = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  tier_id: string | null;
  status: string;
  notes: string | null;
};

export function ClubMemberForm({
  action,
  member,
  tiers,
  error,
}: {
  action: (formData: FormData) => void;
  member?: Member;
  tiers: Tier[];
  error?: string;
}) {
  return (
    <Card className="max-w-xl p-6">
      <form action={action} className="space-y-4">
        {member && <input type="hidden" name="id" value={member.id} />}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <Field label="Full name" required>
          <Input name="full_name" defaultValue={member?.full_name ?? ""} required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input type="email" name="email" defaultValue={member?.email ?? ""} />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={member?.phone ?? ""} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Membership tier" hint="Club fee plans (Fee Plans → Arm: Club).">
            <Select name="tier_id" defaultValue={member?.tier_id ?? ""}>
              <option value="">— none —</option>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.currency} {Number(t.amount).toFixed(2)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={member?.status ?? "active"}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </div>

        <Field label="Notes">
          <Textarea name="notes" defaultValue={member?.notes ?? ""} />
        </Field>

        <div className="flex gap-2 pt-2">
          <SubmitButton pendingText="Saving…">{member ? "Save changes" : "Add member"}</SubmitButton>
          <LinkButton href="/admin/club" variant="secondary">Cancel</LinkButton>
        </div>
      </form>
    </Card>
  );
}
