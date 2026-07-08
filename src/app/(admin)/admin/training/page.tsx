import { requireRole } from "@/lib/auth";
import {
  PageHeader, Section, Field, Input, Button, cn,
} from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { TrainingSyllabus } from "@/components/training-syllabus";
import { ExamItemsEditor } from "@/components/exam-items-editor";
import { TRAINING_LEVELS, levelActiveClass, levelInkClass } from "@/lib/training";
import { loadSyllabus } from "@/lib/syllabus";
import { dict } from "@/lib/i18n";
import { saveLevelEdits, resetSyllabusOverrides } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireRole("admin");
  const L = dict(me.locale);
  const { error, saved } = await searchParams;
  const { levels: mergedLevels, exams: mergedExams } = await loadSyllabus();

  // Build current-effective values keyed for easy form lookup. Use the merged
  // version as defaultValue so the input reflects any active override.
  const levelByNum = new Map(mergedLevels.map((l) => [l.level, l]));
  // Trimmed shape for the (client) item editor — no guidance fields.
  const editorExams = mergedExams.map((e) => ({
    fromLevel: e.fromLevel,
    toLevel: e.toLevel,
    title: e.title,
    review: e.review,
    sections: e.sections.map((s) => ({ key: s.key, label: s.label, max: s.max, items: s.items.map((it) => ({ label: it.label, max: it.max })) })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={L.tr_title}
        description={L.tr_desc}
        action={
          <form action={resetSyllabusOverrides}>
            <ConfirmButton label={L.tr_reset_label} confirmText={L.tr_reset_confirm} />
          </form>
        }
      />

      {saved && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{L.saved}</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <Section title={L.tr_edit_levels} description={L.tr_edit_levels_desc}>
        <form action={saveLevelEdits} className="space-y-4">
          {TRAINING_LEVELS.map((lv) => {
            const m = levelByNum.get(lv.level);
            return (
              <div key={lv.level} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold", levelActiveClass(lv.level))}>{lv.level}</span>
                  <span className={cn("text-sm font-semibold", levelInkClass(lv.level))}>{L.level_word} {lv.level}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={L.col_name} hint={`${L.tr_default}${lv.name}`}>
                    <Input name={`name_${lv.level}`} defaultValue={m?.name ?? lv.name} placeholder={lv.name} />
                  </Field>
                  <Field label={L.tr_objective} hint={`${L.tr_default}${lv.objective}`}>
                    <Input name={`obj_${lv.level}`} defaultValue={m?.objective ?? lv.objective} placeholder={lv.objective} />
                  </Field>
                </div>
              </div>
            );
          })}
          <Button type="submit">{L.tr_save_levels}</Button>
        </form>
      </Section>

      <Section title={L.tr_edit_items} description={L.tr_edit_items_desc}>
        <ExamItemsEditor exams={editorExams} />
      </Section>

      <Section title={L.tr_current} description={L.tr_current_desc}>
        <TrainingSyllabus levels={mergedLevels} exams={mergedExams} />
      </Section>
    </div>
  );
}
