import { Card, Field, Input, Select, Textarea, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ClassRow } from "@/lib/types";
import { CLASS_RANKS } from "@/lib/ranks";
import { dict } from "@/lib/i18n";

export function ClassForm({
  action,
  classRow,
  coaches,
  branches,
  canChooseBranch,
  defaultBranchId,
  error,
  submitLabel,
  locale,
}: {
  action: (formData: FormData) => void;
  classRow?: ClassRow;
  coaches: { id: string; full_name: string | null }[];
  branches?: { id: string; name: string }[];
  canChooseBranch?: boolean;
  defaultBranchId?: string | null;
  error?: string;
  submitLabel?: string;
  locale?: string | null;
}) {
  const L = dict(locale);
  return (
    <Card className="max-w-2xl p-6">
      <form action={action} className="space-y-4">
        {classRow && <input type="hidden" name="id" value={classRow.id} />}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <Field label={L.cf_class_name} required>
          <Input name="name" defaultValue={classRow?.name ?? ""} required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L.cf_class_level} hint={L.cf_class_level_hint}>
            <Select name="level" defaultValue={classRow?.level ?? ""}>
              <option value="">{L.none}</option>
              {CLASS_RANKS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={L.cls_primary_coach}>
            <Select name="coach_id" defaultValue={classRow?.coach_id ?? ""}>
              <option value="">{L.none}</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name ?? c.id}
                </option>
              ))}
            </Select>
          </Field>
          {canChooseBranch && (
            <Field label={L.branch} required hint={L.cf_branch_hint}>
              <Select name="branch_id" defaultValue={classRow?.branch_id ?? defaultBranchId ?? ""} required>
                <option value="">{L.f_select}</option>
                {(branches ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={L.cf_default_location}>
            <Input name="default_location" defaultValue={classRow?.default_location ?? ""} />
          </Field>
          <Field label={L.cf_capacity}>
            <Input type="number" name="capacity" defaultValue={classRow?.capacity ?? ""} />
          </Field>
        </div>

        <Field label={L.cf_description}>
          <Textarea name="description" defaultValue={classRow?.description ?? ""} />
        </Field>

        <div className="flex gap-2 pt-2">
          <SubmitButton pendingText={L.cr_saving}>{submitLabel ?? (classRow ? L.br_save_changes : L.cf_create_class)}</SubmitButton>
          <LinkButton href="/admin/classes" variant="secondary">
            {L.inv_cancel_label}
          </LinkButton>
        </div>
      </form>
    </Card>
  );
}
