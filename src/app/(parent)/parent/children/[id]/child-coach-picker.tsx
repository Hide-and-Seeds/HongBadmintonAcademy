"use client";

import { useState, useTransition } from "react";
import { UserCog, Check } from "lucide-react";
import { Avatar } from "@/components/ui";
import { setChildCoach } from "./child-actions";

// Parent picks the coach responsible for their child. Prominent card so it reads
// as a real, editable choice — shows the current coach's name up top.
export function ChildCoachPicker({
  studentId,
  coaches,
  current,
  labels,
}: {
  studentId: string;
  coaches: { id: string; full_name: string | null }[];
  current: string | null;
  labels: { title: string; hint: string; none: string; saved: string };
}) {
  const [value, setValue] = useState(current ?? "");
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();
  const currentName = coaches.find((c) => c.id === value)?.full_name ?? null;

  function change(next: string) {
    setValue(next);
    setSaved(false);
    start(async () => {
      const r = await setChildCoach({ student_id: studentId, coach_id: next });
      if (r.ok) setSaved(true);
    });
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/40 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <UserCog className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{labels.title}</div>
          <div className="flex items-center gap-2">
            {currentName ? <Avatar name={currentName} size={22} /> : null}
            <span className="truncate text-base font-bold text-slate-900">{currentName ?? labels.none}</span>
            {saved && <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600"><Check className="h-3.5 w-3.5" />{labels.saved}</span>}
          </div>
        </div>
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-500">{labels.hint}</span>
        <select
          value={value}
          onChange={(e) => change(e.target.value)}
          className="h-10 w-full rounded-lg border border-emerald-300 bg-white px-3 text-sm font-medium text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">{labels.none}</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name ?? c.id}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
