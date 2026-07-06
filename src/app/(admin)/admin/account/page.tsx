import { requireRole } from "@/lib/auth";
import { PageHeader, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { FlashClear } from "@/components/flash-clear";
import { changeAdminPassword, updateAdminPhone } from "./actions";
import { PushPanel } from "@/components/push-panel";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push";
import { savePushSubscription, removePushSubscription, sendTestPushToSelf } from "../settings/push-actions";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const me = await requireRole("admin");
  const { saved, error } = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader title="My account" description={me.email ?? undefined} />

      {saved && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {saved === "contact" ? "Phone updated." : "Password updated."}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <FlashClear />

      <Card className="max-w-md p-6">
        <h2 className="text-base font-semibold text-slate-900">Contact</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your phone number. The admin login email is managed in Supabase.
        </p>
        <form action={updateAdminPhone} className="mt-4 space-y-4">
          <Field label="Phone">
            <Input type="tel" name="phone" defaultValue={me.phone ?? ""} autoComplete="tel" placeholder="012-345 6789" />
          </Field>
          <SubmitButton pendingText="…">Save phone</SubmitButton>
        </form>
      </Card>

      <Card className="max-w-md p-6">
        <h2 className="text-base font-semibold text-slate-900">Change password</h2>
        <p className="mt-1 text-sm text-slate-500">Update the password you use to sign in.</p>
        <form action={changeAdminPassword} className="mt-4 space-y-4">
          <Field label="Current password" required>
            <Input type="password" name="current" required autoComplete="current-password" />
          </Field>
          <Field label="New password" required>
            <Input type="password" name="new_password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" required>
            <Input type="password" name="confirm" required minLength={8} autoComplete="new-password" />
          </Field>
          <SubmitButton pendingText="…">Update password</SubmitButton>
        </form>
      </Card>

      {/* Push opt-in — lives here (every admin) since Settings became super-only. */}
      {isPushConfigured() && (
        <Card className="max-w-md overflow-hidden p-0">
          <div className="border-b border-slate-100 p-6 pb-4">
            <h2 className="text-base font-semibold text-slate-900">Notifications</h2>
            <p className="mt-1 text-sm text-slate-500">Get a push for leave requests, payments and system alerts on this device.</p>
          </div>
          <PushPanel
            vapidPublicKey={getVapidPublicKey()}
            save={savePushSubscription}
            remove={removePushSubscription}
            test={sendTestPushToSelf}
          />
        </Card>
      )}
    </div>
  );
}
