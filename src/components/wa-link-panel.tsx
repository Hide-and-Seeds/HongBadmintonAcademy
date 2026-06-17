"use client";

import { useEffect, useState } from "react";

type State = { configured?: boolean; ready?: boolean; dataUrl?: string | null; error?: string };

// Shows the WhatsApp worker's link status + QR (polled from /api/admin/wa-qr,
// which proxies the worker server-side). QR rotates, so we refresh every 12s.
export function WaLinkPanel() {
  const [st, setSt] = useState<State | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const r = await fetch("/api/admin/wa-qr", { cache: "no-store" });
        const j = await r.json();
        if (live) setSt(j);
      } catch {
        if (live) setSt({ configured: true, ready: false, dataUrl: null, error: "unreachable" });
      }
    };
    load();
    const t = setInterval(load, 12000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  if (st === null) {
    return <div className="p-5 text-sm text-slate-500">Checking WhatsApp connection…</div>;
  }
  if (st.configured === false) {
    return (
      <div className="p-5 text-sm text-slate-600">
        Worker not configured. Set <code className="rounded bg-slate-100 px-1.5 py-0.5">WA_WORKER_URL</code> and{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5">WA_WORKER_SECRET</code> in Vercel.
      </div>
    );
  }
  if (st.ready) {
    return (
      <div className="flex items-center gap-2 p-5 text-sm">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        <span className="font-medium text-green-700">WhatsApp connected</span>
        <span className="text-slate-500">— the worker is linked and can send.</span>
      </div>
    );
  }
  if (st.dataUrl) {
    return (
      <div className="flex flex-col items-center gap-3 p-5 text-center">
        <p className="text-sm text-slate-700">
          Scan to link the dedicated number: phone → WhatsApp → <b>Settings → Linked devices → Link a device</b>
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={st.dataUrl} alt="WhatsApp QR code" width={260} height={260} className="rounded-lg border border-slate-200" />
        <p className="text-xs text-slate-400">QR rotates — this refreshes automatically every 12s.</p>
      </div>
    );
  }
  return (
    <div className="p-5 text-sm text-amber-700">
      Worker reachable but no QR yet — it may be starting up or already linking. If this persists, restart the worker on the VM.
      {st.error ? <span className="text-slate-400"> ({st.error})</span> : null}
    </div>
  );
}
