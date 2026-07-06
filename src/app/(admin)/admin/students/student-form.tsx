import { Card, Field, Input, Select, Textarea, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { NfcTagInput } from "@/components/nfc-tag-input";
import { AvatarUpload } from "@/components/avatar-upload";
import { formatCurrency } from "@/lib/format";
import { levelName } from "@/lib/training";
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
}) {
  return (
    <Card className="max-w-2xl p-6">
      <form action={action} className="space-y-4">
        {student && <input type="hidden" name="id" value={student.id} />}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input name="full_name" defaultValue={student?.full_name ?? ""} required />
          </Field>
          <Field label="Nickname" hint="What coaches call them on court.">
            <Input name="nickname" defaultValue={student?.nickname ?? ""} placeholder="e.g. Ah Boy" />
          </Field>
        </div>

        <Field label="Photo" hint="JPG, PNG or WebP. Shows on the kiosk, rosters and the parent app.">
          <AvatarUpload name="photo" currentUrl={student?.photo_url} label={student?.full_name ?? ""} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth">
            <Input type="date" name="dob" defaultValue={student?.dob ?? ""} />
          </Field>
          <Field label="Gender">
            <Input name="gender" defaultValue={student?.gender ?? ""} placeholder="M / F" />
          </Field>
        </div>

        {canChooseBranch && (
          <Field label="Branch" required hint="Which location this student attends.">
            <Select name="branch_id" defaultValue={student?.branch_id ?? defaultBranchId ?? ""} required>
              <option value="">— select —</option>
              {(branches ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Parent">
          <Select name="parent_id" defaultValue={student?.parent_id ?? ""}>
            <option value="">— none —</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.id}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Training level" hint="Set directly; or promote via a graded exam.">
            <Select name="level" defaultValue={String(student?.level ?? 1)}>
              {LEVELS.map((n) => (
                <option key={n} value={n}>L{n} · {levelName(n)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Assigned coach" hint="The coach responsible for this student.">
            <Select name="coach_id" defaultValue={student?.coach_id ?? ""}>
              <option value="">— none —</option>
              {(coaches ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.full_name ?? c.id}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Monthly fee plan"
          hint="Monthly plans auto-raise an invoice each month. Leave blank for ad-hoc billing only."
        >
          <Select name="fee_plan_id" defaultValue={student?.fee_plan_id ?? ""}>
            <option value="">— none —</option>
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
          <Field label="NFC tag UID" hint="Tap Scan and hold the card to your phone, or type it.">
            <NfcTagInput defaultValue={student?.nfc_tag_uid ?? ""} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={student?.status ?? "active"}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </div>

        <Field label="Notes">
          <Textarea name="notes" defaultValue={student?.notes ?? ""} />
        </Field>

        <div className="flex gap-2 pt-2">
          <SubmitButton pendingText="Saving…">{student ? "Save changes" : "Create student"}</SubmitButton>
          <LinkButton href="/admin/students" variant="secondary">
            Cancel
          </LinkButton>
        </div>
      </form>
    </Card>
  );
}
