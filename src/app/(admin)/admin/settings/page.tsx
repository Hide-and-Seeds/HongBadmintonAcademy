import { requireSuperAdmin } from "@/lib/auth";
import { PageHeader, Section, Field, Input, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { isWorkerPaused, getMonthlySchedule, is2faRequired } from "@/lib/settings";
import { WaLinkPanel } from "@/components/wa-link-panel";
import { PushPanel } from "@/components/push-panel";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push";
import { dict } from "@/lib/i18n";
import { toggleWorker, saveMonthlySchedule, toggle2fa } from "./actions";
import { savePushSubscription, removePushSubscription, sendTestPushToSelf } from "./push-actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireSuperAdmin();
  const L = dict(me.locale);
  const { error, saved } = await searchParams;
  const paused = await isWorkerPaused();
  const schedule = await getMonthlySchedule();
  const require2fa = await is2faRequired();

  return (
    <div className="space-y-6">
      <PageHeader title={L.set_title} description={L.set_desc} />

      {saved && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{L.saved}</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <Section title={L.set_security}>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="text-sm text-slate-600">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-medium text-slate-800">{L.set_2fa_label}</span>
              <Badge tone={require2fa ? "green" : "slate"}>{require2fa ? L.set_required : L.set_optional}</Badge>
            </div>
            {require2fa ? L.set_2fa_on : L.set_2fa_off}
            <div className="mt-1 text-xs text-slate-400">{L.set_2fa_note}</div>
          </div>
          <form action={toggle2fa}>
            <input type="hidden" name="required" value={require2fa ? "false" : "true"} />
            <SubmitButton variant={require2fa ? "secondary" : "primary"} pendingText={L.cr_saving}>
              {require2fa ? L.set_make_optional : L.set_require_all}
            </SubmitButton>
          </form>
        </div>
      </Section>

      <Section title={L.set_worker}>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="text-sm text-slate-600">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-medium text-slate-800">{L.set_autosend}</span>
              <Badge tone={paused ? "red" : "green"}>{paused ? L.set_paused : L.set_running}</Badge>
            </div>
            {paused ? L.set_paused_desc : L.set_running_desc}
          </div>
          <form action={toggleWorker}>
            <input type="hidden" name="paused" value={paused ? "false" : "true"} />
            <SubmitButton variant={paused ? "primary" : "secondary"} pendingText={L.cr_saving}>
              {paused ? L.set_resume : L.set_pause}
            </SubmitButton>
          </form>
        </div>
      </Section>

      <Section title={L.set_link_wa} description={L.set_link_wa_desc} flush>
        <WaLinkPanel />
      </Section>

      <Section title={L.set_push_test} description={L.set_push_test_desc} flush>
        {isPushConfigured() ? (
          <PushPanel
            vapidPublicKey={getVapidPublicKey()}
            save={savePushSubscription}
            remove={removePushSubscription}
            test={sendTestPushToSelf}
          />
        ) : (
          <div className="p-5 text-sm text-amber-700">
            {L.set_push_hint}
          </div>
        )}
      </Section>

      <Section title={L.set_schedule}>
        <form action={saveMonthlySchedule} className="space-y-4 p-5">
          <p className="text-sm text-slate-600">
            {L.set_schedule_note}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={L.set_run_day} hint={L.set_run_day_hint}>
              <Input type="number" name="runDay" min={1} max={28} defaultValue={schedule.runDay} />
            </Field>
            <Field label={L.set_due_day}>
              <Input type="number" name="dueDay" min={1} max={28} defaultValue={schedule.dueDay} />
            </Field>
          </div>
          <SubmitButton pendingText={L.cr_saving}>{L.set_save_schedule}</SubmitButton>
        </form>
      </Section>
    </div>
  );
}
