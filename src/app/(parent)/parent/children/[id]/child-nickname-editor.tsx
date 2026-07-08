"use client";

import { useState, useTransition } from "react";
import { Pencil, Check } from "lucide-react";
import { setChildNickname } from "./child-actions";

// Parent-editable display nickname. Kept next to the coach picker as a calm,
// clearly-optional setting. Official full name is unaffected.
export function ChildNicknameEditor({
  studentId,
  current,
  labels,
}: {
  studentId: string;
  current: string | null;
  labels: { title: string; hint: string; placeholder: string; save: string; saved: string };
}) {
  const [value, setValue] = useState(current ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const dirty = value.trim() !== (current ?? "");

  function save() {
    if (!dirty) return;
    setSaved(false);
    start(async () => {
      const r = await setChildNickname({ student_id: studentId, nickname: value });
      if (r.ok) setSaved(true);
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Pencil className="h-3.5 w-3.5" />
        {labels.title}
        {saved && !dirty && (
          <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600"><Check className="h-3.5 w-3.5" />{labels.saved}</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          maxLength={40}
          placeholder={labels.placeholder}
          className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="inline-flex h-9 shrink-0 items-center rounded-lg border border-emerald-600 px-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-40"
        >
          {labels.save}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-slate-400">{labels.hint}</p>
    </div>
  );
}
