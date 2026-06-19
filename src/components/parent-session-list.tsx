"use client";

import { useState } from "react";
import { Clock, MapPin, User, Users, ChevronDown, Star, CalendarCheck } from "lucide-react";
import { Badge, cn } from "@/components/ui";

export type SessionKid = { name: string; status: string | null; tapIn: string | null; rating: number | null };
export type SessionItem = {
  id: string;
  kind: "upcoming" | "past";
  mon: string;
  day: number;
  wd: string;
  timeLabel: string;
  fullDate: string;
  location: string | null;
  className: string;
  coach: string | null;
  status: string;
  who: string[];
  kids: SessionKid[];
};

const ATT_TONE: Record<string, "green" | "yellow" | "red" | "slate"> = {
  present: "green", late: "yellow", absent: "red", excused: "slate",
};

// Tap a session row to expand it. Upcoming → logistics (coach, who, date).
// Past → each child's attendance, tap-in time and the coach's session mark.
export function ParentSessionList({ sessions }: { sessions: SessionItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="divide-y divide-slate-100">
      {sessions.map((s) => {
        const isOpen = open === s.id;
        const upcoming = s.kind === "upcoming";
        return (
          <li key={s.id}>
            <button
              onClick={() => setOpen(isOpen ? null : s.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
            >
              <div className={cn("flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl", upcoming ? "bg-emerald-50" : "bg-slate-100")}>
                <span className={cn("text-[10px] font-semibold uppercase tracking-wide", upcoming ? "text-emerald-600" : "text-slate-500")}>{s.mon}</span>
                <span className={cn("text-xl font-bold leading-none", upcoming ? "text-emerald-800" : "text-slate-700")}>{s.day}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{s.className}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{s.wd} {s.timeLabel}</span>
                  {s.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.location}</span>}
                </div>
              </div>
              {s.status === "canceled" && <Badge tone="red">canceled</Badge>}
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
              <div className="space-y-2 bg-slate-50 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600"><CalendarCheck className="h-4 w-4 text-slate-400" />{s.fullDate}</div>
                {s.coach && <div className="flex items-center gap-2 text-slate-600"><User className="h-4 w-4 text-slate-400" />Coach {s.coach}</div>}

                {upcoming ? (
                  s.who.length > 0 && (
                    <div className="flex items-center gap-2 text-slate-600"><Users className="h-4 w-4 text-slate-400" />{s.who.join(", ")}</div>
                  )
                ) : s.kids.length === 0 ? (
                  <div className="text-slate-400">No attendance recorded.</div>
                ) : (
                  s.kids.map((k, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{k.name}</span>
                      {k.status ? <Badge tone={ATT_TONE[k.status] ?? "slate"}>{k.status}</Badge> : <span className="text-slate-400">not marked</span>}
                      {k.tapIn && <span className="text-xs text-slate-500">tapped {k.tapIn}</span>}
                      {k.rating != null && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Star className="h-3.5 w-3.5" />{k.rating}/5</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
