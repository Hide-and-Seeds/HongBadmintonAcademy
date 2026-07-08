import { Card, Field, Input, Select, Textarea, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { NfcTagInput } from "@/components/nfc-tag-input";
import { AvatarUpload } from "@/components/avatar-upload";
import { formatCurrency } from "@/lib/format";
import { levelName } from "@/lib/training";
import { dict } from "@/lib/i18n";
import type { Student } from "@/lib/types";

const LEVELS = [1, 2, 3, 4, 5, 6];

export function StudentForm({
  action,
  student,
  parents,
  plans,
  coaches,
  branches,
  canChooseBranch,
  defaultBranchId,
  error,
  locale,
}: {
  action: (formData: FormData) => void;
  student?: Student;
  parents: { id: string; full_name: string | null }[];
  plans: { id: string; name: string; amount: number; currency: string; interval: string; rank?: string | null }[];
  coaches?: { id: string; full_name: string | null }[];
  branches?: { id: string; name: string }[];
  canChooseBranch?: boolean;
  defaultBranchId?: string | null;
  error?: string;
  locale?: string | null;
}) {
  const L = dict(locale);
  return (
    <Card className="max-w-2xl p-6">
      <form action={action} className="space-y-4">
        {student && <input type="hidden" name="id" value={student.id} />}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L.sf_full_name} required>
            <Input name="full_name" defaultValue={student?.full_name ?? ""} required />
          </Field>
          <Field label={L.sf_nickname} hint={L.sf_nickname_hint}>
            <Input name="nickname" defaultValue={student?.nickname ?? ""} placeholder="e.g. Ah Boy" />
          </Field>
        </div>

        <Field label={L.sf_photo} hint={L.sf_photo_hint}>
          <AvatarUpload name="photo" currentUrl={student?.photo_url} label={student?.full_name ?? ""} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L.sf_dob}>
            <Input type="date" name="dob" defaultValue={student?.dob ?? ""} />
          </Field>
          <Field label={L.sf_gender}>
            <Input name="gender" defaultValue={student?.gender ?? ""} placeholder="M / F" />
          </Field>
        </div>

        {canChooseBranch && (
          <Field label={L.branch} required hint={L.sf_branch_hint}>
            <Select name="branch_id" defaultValue={student?.branch_id ?? defaultBranchId ?? ""} required>
              <option value="">{L.f_select}</option>
              {(branches ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label={L.inv_parent}>
          <Select name="parent_id" defaultValue={student?.parent_id ?? ""}>
            <option value="">{L.none}</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.id}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L.training_level} hint={L.sf_level_hint}>
            <Select name="level" defaultValue={String(student?.level ?? 1)}>
              {LEVELS.map((n) => (
                <option key={n} value={n}>L{n} · {levelName(n)}</option>
              ))}
            </Select>
          </Field>
          <Field label={L.dir_assigned_coach} hint={L.sf_coach_hint}>
            <Select name="coach_id" defaultValue={student?.coach_id ?? ""}>
              <option value="">{L.none}</option>
              {(coaches ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.full_name ?? c.id}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label={L.sf_fee_plan}
          hint={L.sf_fee_plan_hint}
        >
          <Select name="fee_plan_id" defaultValue={student?.fee_plan_id ?? ""}>
            <option value="">{L.none}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatCurrency(Number(p.amount), p.currency)}
                {p.rank ? ` · ${p.rank}` : ""}
                {p.interval !== "monthly" ? ` (${p.interval})` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L.sf_nfc} hint={L.sf_nfc_hint}>
            <NfcTagInput defaultValue={student?.nfc_tag_uid ?? ""} />
          </Field>
          <Field label={L.col_status}>
            <Select name="status" defaultValue={student?.status ?? "active"}>
              <option value="active">{L.adm_active}</option>
              <option value="inactive">{L.adm_inactive}</option>
            </Select>
          </Field>
        </div>

        <Field label={L.f_notes}>
          <Textarea name="notes" defaultValue={student?.notes ?? ""} />
        </Field>

        <div className="flex gap-2 pt-2">
          <SubmitButton pendingText={L.cr_saving}>{student ? L.br_save_changes : L.sf_create_student}</SubmitButton>
          <LinkButton href="/admin/students" variant="secondary">
            {L.inv_cancel_label}
          </LinkButton>
        </div>
      </form>
    </Card>
  );
}
