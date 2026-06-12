"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass, Input, Card } from "@/components/ui";

interface ScanResult {
  ok: boolean;
  action?: "tap_in" | "tap_out";
  student?: string;
  error?: string;
}

interface LogRow { id: number; ok: boolean; text: string }

export function NfcScanner({ action }: { action: (uid: string) => Promise<ScanResult> }) {
  const [supported, setSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [log, setLog] = useState<LogRow[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "NDEFReader" in window);
  }, []);

  async function record(uid: string) {
    if (busy.current) return; // debounce repeat reads of the same held card
    busy.current = true;
    try {
      const r = await action(uid);
      const text = r.ok
        ? `${r.student} — ${r.action === "tap_in" ? "checked in" : "checked out"}`
        : `${r.error ?? "Failed"} · ${uid}`;
      setLog((l) => [{ id: Date.now() + Math.random(), ok: r.ok, text }, ...l].slice(0, 40));
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(r.ok ? 60 : [40, 40, 40]);
      }
    } finally {
      setTimeout(() => (busy.current = false), 1200);
    }
  }

  async function startScan() {
    setErr(null);
    try {
      const reader = new (window as unknown as { NDEFReader: new () => any }).NDEFReader();
      await reader.scan();
      setScanning(true);
      reader.onreading = (e: { serialNumber?: string }) => {
        if (e.serialNumber) void record(e.serialNumber);
      };
      reader.onreadingerror = () => setErr("Couldn't read that tag — hold it steady and retry.");
    } catch (e) {
      setErr((e as Error)?.message ?? "NFC permission denied or unavailable.");
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const uid = manual.trim();
    if (!uid) return;
    setManual("");
    await record(uid);
  }

  return (
    <div className="space-y-4">
      {supported ? (
        scanning ? (
          <Card className="flex items-center gap-3 border-green-200 bg-green-50 p-5">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="inline-flex h-3 w-3 rounded-full bg-green-600" />
            </span>
            <div className="text-sm font-medium text-green-800">
              Scanning — hold a student card to the back of the phone.
            </div>
          </Card>
        ) : (
          <button type="button" onClick={startScan} className={buttonClass("primary", "w-full py-4 text-base")}>
            📲 Start scanning
          </button>
        )
      ) : (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Tap-to-scan needs <strong>Chrome on Android</strong> (Web NFC). On iPhone or desktop, type the tag
          UID below, or use a dedicated reader posting to the bridge.
        </Card>
      )}

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      <form onSubmit={submitManual} className="flex gap-2">
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or type a tag UID…"
          className="flex-1"
        />
        <button type="submit" className={buttonClass("secondary")}>Tap</button>
      </form>

      <div className="space-y-2">
        {log.length === 0 ? (
          <p className="text-sm text-slate-400">Scanned taps appear here.</p>
        ) : (
          log.map((row) => (
            <div
              key={row.id}
              className={
                "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm " +
                (row.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700")
              }
            >
              <span>{row.ok ? "✓" : "✕"}</span>
              <span>{row.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
