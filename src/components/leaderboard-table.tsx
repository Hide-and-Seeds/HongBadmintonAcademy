"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/components/ui";
import { levelBadgeClass, levelName, TRAINING_LEVELS } from "@/lib/training";

export type LbRow = {
  id: string;
  name: string;
  age: number | null;
  attended: number;
  sessions: number;
  rate: number;
  streak: number;
  level: number;
};

type Col = "level" | "name" | "age" | "attended" | "rate" | "streak";

const MEDAL = ["🥇", "🥈", "🥉"];

export function LeaderboardTable({ rows }: { rows: LbRow[] }) {
  // Default sort: training level desc — the boss-facing "who's furthest along".
  const [col, setCol] = useState<Col>("level");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [q, setQ] = useState("");
  const [levelFilter, setLevelFilter] = useState<number | "">("");

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (levelFilter !== "" && r.level !== levelFilter) return false;
      if (needle && !r.name.toLowerCase().includes(needle)) return false;
      return true;
    });
    const val = (r: LbRow): number | string =>
      col === "name" ? r.name.toLowerCase() : (r[col] as number);
    return filtered.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x < y) return -dir;
      if (x > y) return dir;
      return 0;
    });
  }, [rows, col, dir, q, levelFilter]);

  function sortBy(c: Col) {
    if (c === col) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setCol(c);
      setDir(c === "name" ? 1 : -1);
    }
  }

  function Header({ c, label, align = "center" }: { c: Col; label: string; align?: "left" | "center" }) {
    return (
      <th
        onClick={() => sortBy(c)}
        className={cn(
          "cursor-pointer select-none border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800",
          align === "left" ? "text-left" : "text-center",
        )}
      >
        {label}
        {col === c ? (dir === 1 ? " ▲" : " ▼") : ""}
      </th>
    );
  }

  const fieldCls = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/30";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search student…"
          className={cn(fieldCls, "w-full sm:w-56")}
        />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value === "" ? "" : Number(e.target.value))}
          className={cn(fieldCls, "w-40")}
        >
          <option value="">All levels</option>
          {TRAINING_LEVELS.map((lv) => (
            <option key={lv.level} value={lv.level}>L{lv.level} · {lv.name}</option>
          ))}
        </select>
        {(q || levelFilter !== "") && (
          <button type="button" onClick={() => { setQ(""); setLevelFilter(""); }} className="text-sm text-slate-500 hover:text-slate-900">Clear</button>
        )}
        <span className="ml-auto text-xs text-slate-400">{sorted.length} student{sorted.length === 1 ? "" : "s"}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">#</th>
            <Header c="name" label="Name" align="left" />
            <Header c="level" label="Level" />
            <Header c="age" label="Age" />
            <Header c="attended" label="Attended" />
            <Header c="rate" label="Rate" />
            <Header c="streak" label="Max streak" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="border-b border-slate-100 px-3 py-2.5 text-center text-slate-400">{i < 3 ? MEDAL[i] : i + 1}</td>
              <td className="border-b border-slate-100 px-3 py-2.5 font-medium text-slate-900">
                <Link href={`/admin/students/${r.id}`} className="hover:text-green-700 hover:underline">{r.name}</Link>
              </td>
              <td className="border-b border-slate-100 px-3 py-2.5 text-center">
                <span
                  className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", levelBadgeClass(r.level))}
                  title={`Level ${r.level} · ${levelName(r.level)}`}
                >
                  L{r.level} · {levelName(r.level)}
                </span>
              </td>
              <td className="border-b border-slate-100 px-3 py-2.5 text-center text-slate-500">{r.age ?? "—"}</td>
              <td className="border-b border-slate-100 px-3 py-2.5 text-center text-slate-700">
                {r.attended}
                <span className="text-slate-400">/{r.sessions}</span>
              </td>
              <td className={cn("border-b border-slate-100 px-3 py-2.5 text-center font-semibold", r.rate >= 80 ? "text-green-600" : r.rate >= 50 ? "text-amber-600" : "text-slate-500")}>
                {r.rate}%
              </td>
              <td className="border-b border-slate-100 px-3 py-2.5 text-center font-semibold text-green-700">{r.streak}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-400">No students match.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
