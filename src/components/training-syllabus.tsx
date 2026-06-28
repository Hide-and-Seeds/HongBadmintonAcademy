import { Collapsible } from "@/components/ui";
import type { TrainingLevel, ExamSpec } from "@/lib/training";

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
      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Level curriculum</h2>
        <p className="mb-3 text-xs text-slate-500">What each level trains. Students progress 1 → 6 (Starter → Elite Team). Tap a level to expand.</p>
        <div className="space-y-2">
          {levels.map((lv) => (
            <Collapsible
              key={lv.level}
              defaultOpen={false}
              title={`Level ${lv.level} · ${lv.name} — ${lv.objective}`}
            >
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {lv.groups.map((g) => (
                  <div key={g.label}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{g.label}</div>
                    <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                      {g.items.map((it) => <li key={it}>· {it}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Collapsible>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Promotion exams</h2>
        <p className="mb-3 text-xs text-slate-500">Each level jump is graded on a fixed 100-point rubric: Technical 40 · Footwork 25 · Game/Tactical 20 · Physical/Attitude 15. ≥ 70 promotes. Tap an exam to expand.</p>
        <div className="space-y-2">
          {exams.map((spec) => (
            <Collapsible
              key={spec.fromLevel}
              defaultOpen={false}
              title={spec.review ? `${spec.title} · Level ${spec.fromLevel} Elite review` : `${spec.title} · Level ${spec.fromLevel} → ${spec.toLevel} (${levelName(spec.toLevel)})`}
            >
              <div className="grid gap-3 p-4 sm:grid-cols-2">
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
            </Collapsible>
          ))}
        </div>
      </div>
    </div>
  );
}
