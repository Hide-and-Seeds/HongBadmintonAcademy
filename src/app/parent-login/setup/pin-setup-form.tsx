"use client";

import { useState } from "react";
import { submitPinSetup } from "../actions";

export function PinSetupForm({ error }: { error?: string }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.set("pin", pin);
    fd.set("confirm", confirm);
    await submitPinSetup(fd);
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700">Choose a 4-digit PIN</label>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          required
          pattern="\d{4}"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="••••"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-2xl tracking-[0.5em] shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Confirm PIN</label>
        <input
          type="password"
          inputMode="numeric"
          required
          pattern="\d{4}"
          maxLength={4}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="••••"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-2xl tracking-[0.5em] shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || pin.length !== 4 || confirm.length !== 4}
        className="w-full rounded-xl bg-green-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-green-700 active:scale-95 disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Save PIN & continue"}
      </button>

      <p className="text-center text-xs text-slate-400">
        After 5 wrong attempts your account locks. Admin can unlock from the dashboard.
      </p>
    </form>
  );
}
