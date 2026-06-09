"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/components/ui";

type Student = { id: string; full_name: string };
type AttRow = { student_id: string; status: string; tap_in_at: string | null; tap_out_at: string | null };
type Mark = { status: string; tap_in_at: string | null; tap_out_at: string | null };
type LogEntry = { key: string; name: string; label: string; tone: string; at: string };

const DOT: Record<string, string> = {
  present: "bg-green-500", late: "bg-amber-500", absent: "bg-red-500", excused: "bg-slate-400",
};

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-MY", {
    hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur",
  });
}

export function LiveCheckIn({
  sessions,
  selectedId,
  session,
  roster,
  initial,
}: {
  sessions: { id: string; label: string }[];
  selectedId: string | null;
  session: { id: string; className: string; time: string; location: string | null } | null;
  roster: Student[];
  initial: AttRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const nameById = useMemo(
    () => Object.fromEntries(roster.map((s) => [s.id, s.full_name])),
    [roster],
  );
  const initMarks = useMemo(() => {
    const m: Record<string, Mark> = {};
    for (const a of initial) m[a.student_id] = { status: a.status, tap_in_at: a.tap_in_at, tap_out_at: a.tap_out_at };
    return m;
  }, [initial]);

  const [marks, setMarks] = useState<Record<string, Mark>>(initMarks);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [flash, setFlash] = useState<{ name: string; label: string; tone: string } | null>(null);
  const [pick, setPick] = useState<string>(roster[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const marksRef = useRef<Record<string, Mark>>(initMarks);

  function applyRows(data: AttRow[]) {
    const events: LogEntry[] = [];
    const next = { ...marksRef.current };
    for (const row of data) {
      const prev = marksRef.current[row.student_id];
      const newOut = !!row.tap_out_at && !(prev && prev.tap_out_at);
      const statusChanged = !prev || prev.status !== row.status;
      if (statusChanged || newOut) {
        const tappedOut = newOut && !statusChanged;
        events.push({
          key: row.student_id + (row.tap_out_at ?? row.tap_in_at ?? String(Date.now())),
          name: nameById[row.student_id] ?? "Unknown card",
          label: tappedOut ? "tapped out" : row.status,
          tone: tappedOut ? "slate" : row.status,
          at: row.tap_out_at ?? row.tap_in_at ?? new Date().toISOString(),
        });
      }
      next[row.student_id] = { status: row.status, tap_in_at: row.tap_in_at, tap_out_at: row.tap_out_at };
    }
    if (events.length) {
      marksRef.current = next;
      setMarks(next);
      setLog((l) => [...events.slice().reverse(), ...l].slice(0, 15));
      const latest = events[events.length - 1];
      setFlash({ name: latest.name, label: latest.label, tone: latest.tone });
    }
  }

  // Poll the selected session for new taps (NFC or manual) every 2.5s.
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    async function poll() {
      const { data } = await supabase
        .from("attendance")
        .select("student_id, status, tap_in_at, tap_out_at")
        .eq("session_id", selectedId);
      if (alive && data) applyRows(data as AttRow[]);
    }
    const iv = setInterval(poll, 2500);
    return () => { alive = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, supabase]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  async function manualTap() {
    if (!selectedId || !pick || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: selectedId, student_id: pick }),
      });
      const j = await res.json();
      if (j.ok) {
        const prev = marksRef.current[pick];
        const tappedOut = j.action === "tap_out";
        const status = tappedOut ? prev?.status ?? "present" : j.status;
        marksRef.current = {
          ...marksRef.current,
          [pick]: {
            status,
            tap_in_at: prev?.tap_in_at ?? j.at,
            tap_out_at: tappedOut ? j.at : prev?.tap_out_at ?? null,
          },
        };
        setMarks(marksRef.current);
        const label = tappedOut ? "tapped out" : j.status;
        const entry: LogEntry = { key: pick + j.at, name: nameById[pick] ?? "Student", label, tone: tappedOut ? "slate" : j.status, at: j.at };
        setLog((l) => [entry, ...l].slice(0, 15));
        setFlash({ name: entry.name, label, tone: entry.tone });
      }
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;

  const checkedIn = Object.values(marks).filter((m) => m.status === "present" || m.status === "late").length;
  const flashBg = !flash
    ? "bg-green-700"
    : flash.tone === "late" ? "bg-amber-500" : flash.tone === "slate" ? "bg-slate-500" : "bg-green-600";

  return (
    <div className="space-y-5">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Session</span>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          value={selectedId ?? ""}
          onChange={(e) => router.push(`/admin/attendance/live?session=${e.target.value}`)}
        >
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <span className="text-slate-400">{session.time}{session.location ? ` · ${session.location}` : ""}</span>
      </label>

      {/* Tap target — lights up on each tap */}
      <div className="flex justify-center py-2">
        <div className={cn("flex h-56 w-56 flex-col items-center justify-center rounded-full px-4 text-center text-white shadow-lg transition-colors duration-200", flashBg)}>
          {flash ? (
            <>
              <span className="text-4xl">✓</span>
              <span className="mt-1 text-lg font-semibold leading-tight">{flash.name}</span>
              <span className="text-sm capitalize opacity-90">{flash.label}</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-semibold">Tap card here</span>
              <span className="mt-1 text-sm opacity-80">{checkedIn}/{roster.length} checked in</span>
            </>
          )}
        </div>
      </div>

      {/* Manual fallback (no reader / failed card) */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
          {roster.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <button
          onClick={manualTap}
          disabled={busy || !pick}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? "…" : "Manual tap"}
        </button>
      </div>

      {/* Live roster — who's in */}
      <div className="flex flex-wrap justify-center gap-2">
        {roster.map((s) => {
          const m = marks[s.id];
          return (
            <span
              key={s.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
                !m && "border border-slate-200 bg-white text-slate-500",
                m?.status === "present" && "bg-green-100 text-green-800",
                m?.status === "late" && "bg-amber-100 text-amber-800",
                m?.status === "absent" && "bg-red-100 text-red-700",
                m?.status === "excused" && "bg-slate-100 text-slate-600",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", m ? DOT[m.status] : "bg-slate-300")} />
              {s.full_name}
            </span>
          );
        })}
      </div>

      {/* System log */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 font-mono text-xs text-slate-300">
        <div className="mb-2 uppercase tracking-wider text-slate-500">System log</div>
        {log.length === 0 ? (
          <div className="text-slate-500">Awaiting taps…</div>
        ) : (
          <ul className="space-y-1">
            {log.map((e) => (
              <li key={e.key}>
                <span className="text-slate-500">{timeStr(e.at)}</span>{"  "}
                <span className="text-slate-100">{e.name}</span>{" · "}
                <span className={cn(e.tone === "late" ? "text-amber-400" : e.tone === "slate" ? "text-slate-400" : "text-green-400")}>{e.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
