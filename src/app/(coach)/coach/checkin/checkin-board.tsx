"use client";

import { useState, useTransition } from "react";
import { Avatar, Badge, Section, cn } from "@/components/ui";
import { Check, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { formatTime } from "@/lib/format";
import type { AttendanceStatus } from "@/lib/types";
import {
  setAttendanceAction, setPerfAction, markAllPresentAction,
  searchAddableStudentsAction, addDropInAction,
  clearAttendanceAction, setCoachCheckin,
} from "./board-actions";

export interface Roster {
  student: { id: string; full_name: string; photo_url?: string | null };
  att?: { status: AttendanceStatus; tap_in_at: string | null } | null;
  mark?: number | null;
  dropIn?: boolean;
}

export interface Block {
  session: {
    id: string;
    class_id: string;
    start_time: string;
    end_time: string;
    location: string | null;
    session_date?: string;
    grace_minutes?: number | null;
    classes?: { name: string | null } | null;
  };
  roster: Roster[];
  coachedIn?: boolean;
}

type AddableStudent = { id: string; full_name: string; photo_url: string | null };

// Present is the one-tap green check on every row; the expanded panel only
// carries the exceptions so there are fewer buttons to scan.
const MARKS: { status: AttendanceStatus; label: string; on: string }[] = [
  { status: "late", label: "Late", on: "bg-amber-500 text-white" },
  { status: "absent", label: "Absent", on: "bg-red-600 text-white" },
  { status: "excused", label: "Excused", on: "bg-slate-600 text-white" },
];

export function CheckinBoard({ initialBlocks }: { initialBlocks: Block[] }) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // When a coach has more than one class today, show one session at a time.
  const [activeIdx, setActiveIdx] = useState(0);

  // Drop-in add panel (only one open at a time).
  const [addFor, setAddFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddableStudent[]>([]);
  const [searching, setSearching] = useState(false);

  const rowKey = (sId: string, stId: string) => `${sId}:${stId}`;

  function patchRow(sId: string, stId: string, patch: Partial<Roster>) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.session.id !== sId
          ? b
          : {
              ...b,
              roster: b.roster.map((r) => (r.student.id !== stId ? r : { ...r, ...patch })),
            },
      ),
    );
  }

  function setStatus(sId: string, stId: string, status: AttendanceStatus) {
    const key = rowKey(sId, stId);
    const snapshot = blocks;
    setBusy((b) => ({ ...b, [key]: true }));
    patchRow(sId, stId, { att: { status, tap_in_at: null } });
    startTransition(async () => {
      const r = await setAttendanceAction({ session_id: sId, student_id: stId, status });
      if (!r.ok) setBlocks(snapshot);
      setBusy((b) => {
        const next = { ...b };
        delete next[key];
        return next;
      });
    });
  }

  function clearStatus(sId: string, stId: string) {
    const key = rowKey(sId, stId);
    const snapshot = blocks;
    setBusy((b) => ({ ...b, [key]: true }));
    patchRow(sId, stId, { att: null });
    startTransition(async () => {
      const r = await clearAttendanceAction({ session_id: sId, student_id: stId });
      if (!r.ok) setBlocks(snapshot);
      setBusy((b) => {
        const next = { ...b };
        delete next[key];
        return next;
      });
    });
  }

  function setCoach(sId: string, on: boolean) {
    const snapshot = blocks;
    setBlocks((prev) => prev.map((b) => (b.session.id !== sId ? b : { ...b, coachedIn: on })));
    startTransition(async () => {
      const r = await setCoachCheckin({ session_id: sId, on });
      if (!r.ok) setBlocks(snapshot);
    });
  }

  function setPerf(sId: string, stId: string, rating: number) {
    const snapshot = blocks;
    patchRow(sId, stId, { mark: rating });
    startTransition(async () => {
      const r = await setPerfAction({ session_id: sId, student_id: stId, rating });
      if (!r.ok) setBlocks(snapshot);
    });
  }

  function markAllRemaining(sId: string) {
    const block = blocks.find((b) => b.session.id === sId);
    if (!block) return;
    const unmarked = block.roster.filter((r) => !r.att).map((r) => r.student.id);
    if (!unmarked.length) return;
    const snapshot = blocks;
    setBlocks((prev) =>
      prev.map((b) =>
        b.session.id !== sId
          ? b
          : {
              ...b,
              roster: b.roster.map((r) =>
                unmarked.includes(r.student.id)
                  ? { ...r, att: { status: "present", tap_in_at: null } }
                  : r,
              ),
            },
      ),
    );
    startTransition(async () => {
      const r = await markAllPresentAction({ session_id: sId, student_ids: unmarked });
      if (!r.ok) setBlocks(snapshot);
    });
  }

  function toggleExpand(key: string) {
    setExpanded((e) => ({ ...e, [key]: !e[key] }));
  }

  function openAdd(sId: string) {
    setAddFor((cur) => (cur === sId ? null : sId));
    setQuery("");
    setResults([]);
  }
  function closeAdd() {
    setAddFor(null);
    setQuery("");
    setResults([]);
  }

  function runSearch(sId: string, text: string) {
    setQuery(text);
    const q = text.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    startTransition(async () => {
      const r = await searchAddableStudentsAction({ session_id: sId, q });
      setSearching(false);
      if (!r.ok) {
        setResults([]);
        return;
      }
      const block = blocks.find((b) => b.session.id === sId);
      const have = new Set((block?.roster ?? []).map((x) => x.student.id));
      setResults(r.students.filter((s) => !have.has(s.id)));
    });
  }

  function addDropIn(sId: string, student: AddableStudent) {
    // Optimistic: drop them onto the roster as present, then persist.
    setBlocks((prev) =>
      prev.map((b) =>
        b.session.id !== sId || b.roster.some((r) => r.student.id === student.id)
          ? b
          : { ...b, roster: [...b.roster, { student, att: { status: "present", tap_in_at: null }, mark: null, dropIn: true }] },
      ),
    );
    closeAdd();
    startTransition(async () => {
      const r = await addDropInAction({ session_id: sId, student_id: student.id });
      if (!r.ok) {
        setBlocks((prev) =>
          prev.map((b) =>
            b.session.id !== sId ? b : { ...b, roster: b.roster.filter((x) => x.student.id !== student.id) },
          ),
        );
      }
    });
  }

  const idx = Math.min(activeIdx, blocks.length - 1);
  const visible = blocks.length > 1 ? [blocks[idx]] : blocks;

  return (
    <div className="space-y-4">
      {blocks.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {blocks.map((b, i) => (
            <button
              key={b.session.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors",
                i === idx ? "bg-green-600 text-white ring-transparent" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50",
              )}
            >
              {b.session.classes?.name ?? "Class"} · {formatTime(b.session.start_time)}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {visible.map(({ session, roster, coachedIn }) => {
          const present = roster.filter(
            (r) => r.att && (r.att.status === "present" || r.att.status === "late"),
          ).length;
          const unmarked = roster.filter((r) => !r.att).length;
          return (
            <Section
              key={session.id}
              title={session.classes?.name ?? "Class"}
              description={`${formatTime(session.start_time)}–${formatTime(session.end_time)} · ${
                session.location ?? "—"
              }`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCoach(session.id, !coachedIn)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors",
                      coachedIn ? "bg-emerald-600 text-white ring-transparent" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50",
                    )}
                    title="Record that you showed up to this session"
                  >
                    {coachedIn ? "✓ I'm on court" : "I'm here"}
                  </button>
                  <Badge tone={roster.length && present === roster.length ? "green" : "blue"}>
                    {present}/{roster.length} present
                  </Badge>
                  {unmarked > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllRemaining(session.id)}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-green-700 active:bg-green-800"
                    >
                      ✓ Mark {unmarked} present
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openAdd(session.id)}
                    aria-expanded={addFor === session.id}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add student
                  </button>
                </div>
              }
              flush
            >
              {addFor === session.id && (
                <div className="border-b border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => runSearch(session.id, e.target.value)}
                      placeholder="Search a student to add as drop-in…"
                      className="h-9 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                    <button type="button" onClick={closeAdd} aria-label="Close" className="shrink-0 text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {query.trim().length >= 1 && (
                    <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200 bg-white">
                      {searching && <li className="px-3 py-2 text-sm text-slate-400">Searching…</li>}
                      {!searching && results.length === 0 && (
                        <li className="px-3 py-2 text-sm text-slate-400">No matches.</li>
                      )}
                      {results.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => addDropIn(session.id, s)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <Avatar name={s.full_name} src={s.photo_url} size={32} />
                            <span className="truncate text-sm font-medium text-slate-800">{s.full_name}</span>
                            <span className="ml-auto shrink-0 text-xs font-semibold text-green-600">Add →</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <ul className="divide-y divide-slate-100">
                {roster.map((r) => {
                  const cur = r.att?.status;
                  const key = rowKey(session.id, r.student.id);
                  const isExpanded = !!expanded[key];
                  const isBusy = !!busy[key];
                  return (
                    <li key={r.student.id} className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.student.full_name} src={r.student.photo_url} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-slate-900">
                            {r.student.full_name}
                            {r.dropIn && (
                              <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-emerald-700">
                                drop-in
                              </span>
                            )}
                          </div>
                          <div
                            className={cn(
                              "text-xs font-medium",
                              cur === "present" ? "text-green-600"
                                : cur === "late" ? "text-amber-600"
                                : cur === "absent" ? "text-red-600"
                                : cur === "excused" ? "text-slate-500"
                                : "text-slate-400",
                            )}
                          >
                            {cur === "present" ? "Present"
                              : cur === "late" ? "Late"
                              : cur === "absent" ? "Absent"
                              : cur === "excused" ? "Excused"
                              : "Tap to mark present"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStatus(session.id, r.student.id, "present")}
                          disabled={isBusy}
                          aria-label="Mark present"
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                            cur === "present"
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-slate-300 text-transparent hover:border-green-400 hover:text-green-300",
                            isBusy && "opacity-60",
                          )}
                        >
                          <Check className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleExpand(key)}
                          aria-expanded={isExpanded}
                          aria-label="More options"
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                            isExpanded ? "border-green-300 bg-green-50 text-green-600" : "border-slate-200 text-slate-400 hover:bg-slate-50",
                            Boolean(r.mark) && !isExpanded && "text-amber-500",
                          )}
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="mt-2.5 space-y-2.5 border-t border-dashed border-slate-100 pl-12 pt-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {MARKS.map((m) => (
                              <button
                                key={m.status}
                                type="button"
                                onClick={() => setStatus(session.id, r.student.id, m.status)}
                                disabled={isBusy}
                                className={cn(
                                  "rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                                  cur === m.status ? `${m.on} ring-transparent` : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50",
                                )}
                              >
                                {m.label}
                              </button>
                            ))}
                            {cur && (
                              <button
                                type="button"
                                onClick={() => clearStatus(session.id, r.student.id)}
                                disabled={isBusy}
                                className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-200 transition-colors hover:bg-red-50"
                                title="Remove this attendance mark"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Rate</span>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setPerf(session.id, r.student.id, n)}
                                className={cn(
                                  "flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ring-1 ring-inset transition-colors",
                                  r.mark === n ? "bg-green-600 text-white ring-transparent" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50",
                                )}
                              >
                                {n}
                              </button>
                            ))}
                            <span className="ml-1 text-xs text-slate-400">1 = needs work · 5 = excellent</span>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
                {roster.length === 0 && (
                  <li className="px-5 py-3 text-sm text-slate-400">No students enrolled.</li>
                )}
              </ul>
            </Section>
          );
        })}
      </div>
    </div>
  );
}
