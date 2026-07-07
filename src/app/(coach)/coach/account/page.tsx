import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { FlashClear } from "@/components/flash-clear";
import { TwoFactorSetup } from "@/components/two-factor-setup";
import { dict } from "@/lib/i18n";
import { changeCoachPassword, updateCoachContact } from "./actions";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push";
import { PushPanel } from "@/components/push-panel";
import { saveCoachPush, removeCoachPush, sendTestCoachPush } from "./push-actions";

export const dynamic = "force-dynamic";

export default async function CoachAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const me = await requireRole("coach");
  const L = dict(me.locale);
  const { saved, error } = await searchParams;
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = (factors?.totp ?? []).find((f) => f.status === "verified") ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title={L.account} description={me.email ?? undefined} />

      {saved && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {saved === "contact" ? L.contact_updated : L.password_updated}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <FlashClear />

      <Card className="max-w-md p-6">
        <h2 className="text-base font-semibold text-slate-900">{L.contact_details}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {L.account_email_hint}
        </p>
        <form action={updateCoachContact} className="mt-4 space-y-4">
          <Field label={L.email_label} required>
            <Input type="email" name="email" defaultValue={me.email ?? ""} required autoComplete="email" />
          </Field>
          <Field label={L.phone_label}>
            <Input type="tel" name="phone" defaultValue={me.phone ?? ""} autoComplete="tel" placeholder="012-345 6789" />
          </Field>
          <Field label={L.current_pw} hint={L.pw_email_only}>
            <Input type="password" name="current" autoComplete="current-password" />
          </Field>
          <SubmitButton pendingText="…">{L.save_contact}</SubmitButton>
        </form>
      </Card>

      <Card className="max-w-md p-6">
        <h2 className="text-base font-semibold text-slate-900">{L.change_password}</h2>
        <p className="mt-1 text-sm text-slate-500">{L.change_pw_hint}</p>
        <form action={changeCoachPassword} className="mt-4 space-y-4">
          <Field label={L.current_pw} required>
            <Input type="password" name="current" required autoComplete="current-password" />
          </Field>
          <Field label={L.new_pw} required>
            <Input type="password" name="new_password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label={L.confirm_pw} required>
            <Input type="password" name="confirm" required minLength={8} autoComplete="new-password" />
          </Field>
          <SubmitButton pendingText="…">{L.update_password}</SubmitButton>
        </form>
      </Card>

      <Card className="max-w-md p-6">
        <h2 className="text-base font-semibold text-slate-900">{L.two_factor}</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">{L.two_factor_hint}</p>
        <TwoFactorSetup enrolled={!!totp} factorId={totp?.id ?? null} />
      </Card>

      {isPushConfigured() && (
        <Card className="max-w-md overflow-hidden p-0">
          <div className="border-b border-slate-100 p-6 pb-4">
            <h2 className="text-base font-semibold text-slate-900">{L.notifications}</h2>
            <p className="mt-1 text-sm text-slate-500">{L.notif_hint}</p>
          </div>
          <PushPanel
            vapidPublicKey={getVapidPublicKey()}
            save={saveCoachPush}
            remove={removeCoachPush}
            test={sendTestCoachPush}
          />
        </Card>
      )}
    </div>
  );
}
