"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { enrollTotp, verifyTotp, unenrollTotp } from "@/app/staff-2fa-actions";

// Account card: enable TOTP 2FA (enroll → scan QR → verify a code) or turn it
// off. Reloads on success so the server re-reads the factor state.
export function TwoFactorSetup({ enrolled, factorId }: { enrolled: boolean; factorId: string | null }) {
  const [step, setStep] = useState<"idle" | "enrolling">("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingFactor, setPendingFactor] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function begin() {
    setError(null);
    start(async () => {
      const r = await enrollTotp();
      if (!r.ok) { setError(r.error ?? "Couldn't start 2FA setup."); return; }
      setQr(r.qr ?? null);
      setSecret(r.secret ?? null);
      setPendingFactor(r.factorId ?? null);
      setStep("enrolling");
    });
  }

  function confirm() {
    if (!pendingFactor) return;
    setError(null);
    start(async () => {
      const r = await verifyTotp(pendingFactor, code);
      if (!r.ok) { setError(r.error ?? "That code didn't match."); return; }
      window.location.reload();
    });
  }

  function disable() {
    if (!factorId) return;
    start(async () => {
      const r = await unenrollTotp(factorId);
      if (!r.ok) { setError(r.error ?? "Couldn't turn off 2FA."); return; }
      window.location.reload();
    });
  }

  if (enrolled) {
    return (
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          <ShieldCheck className="h-4 w-4" /> Two-factor is on
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <ShieldOff className="h-4 w-4" /> Turn off
        </button>
      </div>
    );
  }

  if (step === "enrolling") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Scan this with Google Authenticator / Authy, then enter the 6-digit code.</p>
        <div className="flex flex-wrap items-start gap-4">
          {qr && (qr.startsWith("data:")
            ? <img src={qr} alt="2FA QR code" width={160} height={160} className="rounded-lg border border-slate-200" />
            : <span className="inline-block rounded-lg border border-slate-200 bg-white p-2 [&>svg]:h-40 [&>svg]:w-40" dangerouslySetInnerHTML={{ __html: qr }} />
          )}
          {secret && (
            <div className="text-xs text-slate-500">
              <div className="mb-1 font-medium text-slate-600">Or enter this key manually:</div>
              <code className="break-all rounded bg-slate-100 px-1.5 py-1 text-slate-700">{secret}</code>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            className="h-10 w-32 rounded-lg border border-slate-300 text-center text-lg tracking-widest focus:border-green-500 focus:outline-none"
          />
          <button type="button" onClick={confirm} disabled={busy || code.length < 6} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Verify & enable
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">Protect your staff account with an authenticator-app code at sign-in.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" onClick={begin} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
        <ShieldCheck className="h-4 w-4" /> Enable 2FA
      </button>
    </div>
  );
}
