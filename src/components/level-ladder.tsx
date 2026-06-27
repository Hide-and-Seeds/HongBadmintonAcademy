import { Check, Trophy } from "lucide-react";
import { TRAINING_LEVELS, levelName, levelActiveClass, levelInkClass } from "@/lib/training";
import { cn } from "@/components/ui";

const DONE_BG: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-700",
  2: "bg-teal-100 text-teal-700",
  3: "bg-blue-100 text-blue-700",
  4: "bg-amber-100 text-amber-700",
  5: "bg-rose-100 text-rose-700",
  6: "bg-purple-100 text-purple-700",
};

// Horizontal 1 → 6 training ladder (Starter → Elite Team) with the student's
// current level highlighted and lower levels marked done. The single source of
// truth for a student's standing on the parent dashboard — replaces the old
// 4-tier RankLadder here so parents see one ladder, not two. Server-safe.
export function LevelLadder({ current }: { current: number | null }) {
  const cur = current ?? 1;
  const fillPct = cur > 1 ? ((cur - 1) / (TRAINING_LEVELS.length - 1)) * 100 : 0;

  return (
    <div>
      <div className="relative flex justify-between px-1">
        <div className="absolute left-4 right-4 top-4 h-0.5 rounded-full bg-slate-200" />
        <div className="absolute left-4 top-4 h-0.5 rounded-full bg-slate-400" style={{ width: `calc(${fillPct}% - ${fillPct > 0 ? "1rem" : "0px"})` }} />
        {TRAINING_LEVELS.map((lv) => {
          const done = lv.level < cur;
          const isCurrent = lv.level === cur;
          return (
            <div key={lv.level} className="relative z-10 flex flex-col items-center">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                  done && DONE_BG[lv.level],
                  isCurrent && levelActiveClass(lv.level),
                  !done && !isCurrent && "border-2 border-slate-200 bg-white text-slate-400",
                )}
                title={lv.name}
              >
                {done ? <Check className="h-4 w-4" /> : lv.level === 6 ? <Trophy className="h-4 w-4" /> : lv.level}
              </span>
            </div>
          );
        })}
      </div>
      <div className={cn("mt-2 text-center text-sm font-semibold", levelInkClass(cur))}>
        Level {cur} · {levelName(cur)}
      </div>
    </div>
  );
}

