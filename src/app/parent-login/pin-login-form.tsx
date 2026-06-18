"use client";

import { useState } from "react";
import { signInWithPin } from "./actions";

export function PinLoginForm({ error, next }: { error?: string; next: string | null }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.set("phone", phone);
    fd.set("pin", pin);
    if (next) fd.set("next", next);
    await signInWithPin(fd);
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700">Phone number</label>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="012-345 6789"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">4-digit PIN</label>
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          pattern="\d{4}"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="••••"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-2xl tracking-[0.5em] shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || pin.length !== 4 || phone.length < 6}
        className="w-full rounded-xl bg-green-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-green-700 active:scale-95 disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
