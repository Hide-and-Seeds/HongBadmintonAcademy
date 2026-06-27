import { Section, Badge, cn } from "@/components/ui";
import {
  levelActiveClass, levelInkClass,
  type TrainingLevel, type ExamSpec,
} from "@/lib/training";

// Read-only reference for the full HBA Training System: per-level curriculum +
// the promotion-exam rubric between each level. Shared by the admin syllabus page
// (and safe to surface to coaches). Server component — no client JS.
export function TrainingSyllabus({
  levels,
  exams,
}: {
  levels: TrainingLevel[];
  exams: ExamSpec[];
}) {
  const nameByLevel = new Map(levels.map((l) => [l.level, l.name]));
  const levelName = (n: number) => nameByLevel.get(n) ?? "—";
  return (
    <div className="space-y-8">
      <Section title="Level curriculum" description="What each level trains. Students progress 1 → 6 (Starter → Elite Team).">
        <div className="space-y-5">
          {levels.map((lv) => (
            <div key={lv.level} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold", levelActiveClass(lv.level))}>{lv.level}</span>
                <span className={cn("text-base font-semibold", levelInkClass(lv.level))}>{lv.name}</span>
                <span className="text-sm text-slate-400">{lv.objective}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {lv.groups.map((g) => (
                  <div key={g.label}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{g.label}</div>
                    <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                      {g.items.map((it) => <li key={it}>· {it}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Promotion exams" description="Each level jump is graded on a fixed 100-point rubric: Technical 40 · Footwork 25 · Game/Tactical 20 · Physical/Attitude 15. ≥ 70 promotes.">
        <div className="space-y-5">
          {exams.map((spec) => (
            <div key={spec.fromLevel} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{spec.title}</span>
                {spec.review ? (
                  <Badge tone="slate">Level {spec.fromLevel} · Elite review</Badge>
                ) : (
                  <Badge tone="blue">Level {spec.fromLevel} → {spec.toLevel} ({levelName(spec.toLevel)})</Badge>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {spec.sections.map((sec) => (
                  <div key={sec.key}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{sec.label}</span>
                      <span className="text-xs font-medium text-slate-400">/ {sec.max}</span>
                    </div>
                    <ul className="mt-1 space-y-1.5 text-sm text-slate-700">
                      {sec.items.map((it) => (
                        <li key={it.label}>
                          <div className="flex items-center justify-between gap-2">
                            <span>· {it.label}</span>
                            <span className="shrink-0 text-xs text-slate-400">{it.max}</span>
                          </div>
                          {(it.method || it.pass) && (
                            <div className="ml-3 mt-0.5 space-y-0.5 text-xs text-slate-400">
                              {it.method && <div>{it.method}</div>}
                              {it.pass && <div className="text-green-700">Pass: {it.pass}</div>}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
