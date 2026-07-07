import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { verifyLoginTotp, cancelLoginTotp, useBackupCode } from "./actions";

export const dynamic = "force-dynamic";

export default async function TwoFactorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; mode?: string }>;
}) {
  const { error, next, mode } = await searchParams;
  const backup = mode === "backup";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Already cleared the second factor → nothing to do here.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal || aal.currentLevel === "aal2" || aal.nextLevel !== "aal2") redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-white"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Two-factor check</h1>
            <p className="text-xs text-slate-500">Enter the 6-digit code from your authenticator app.</p>
          </div>
        </div>

        {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {backup ? (
          <form action={useBackupCode} className="space-y-3">
            <p className="text-sm text-slate-600">Enter one of your saved backup codes.</p>
            <input
              name="code"
              autoComplete="off"
              maxLength={12}
              required
              autoFocus
              placeholder="abcd-1234"
              className="h-12 w-full rounded-lg border border-slate-300 text-center font-mono text-lg tracking-widest text-slate-900 focus:border-green-500 focus:outline-none"
            />
            <SubmitButton className="w-full" pendingText="Checking…">Use backup code</SubmitButton>
            <div className="text-center">
              <Link href="/login/2fa" className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline">← Back to code entry</Link>
            </div>
          </form>
        ) : (
          <form action={verifyLoginTotp} className="space-y-3">
            {next && <input type="hidden" name="next" value={next} />}
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              className="h-12 w-full rounded-lg border border-slate-300 text-center text-2xl tracking-[0.3em] text-slate-900 focus:border-green-500 focus:outline-none"
            />
            <SubmitButton className="w-full" pendingText="Checking…">Verify</SubmitButton>
          </form>
        )}

        <div className="mt-3 flex items-center justify-between text-xs">
          {!backup ? (
            <Link href="/login/2fa?mode=backup" className="font-medium text-slate-500 hover:text-slate-700 hover:underline">Lost your device? Use a backup code</Link>
          ) : <span />}
          <form action={cancelLoginTotp}>
            <button type="submit" className="font-medium text-slate-500 hover:text-slate-700 hover:underline">Use a different account</button>
          </form>
        </div>
      </div>
    </div>
  );
}
