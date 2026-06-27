import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TRAINING_LEVELS, EXAM_SPECS,
  type TrainingLevel, type ExamSpec,
} from "@/lib/training";

// Admin can override the per-level *name* + *objective* + per-exam-item *label*
// without re-deploying. Item maxes, section caps and the 100-pt rubric stay
// hardcoded (changing them would break score history). Editing curriculum
// groups/items is also intentionally out of scope until the boss asks for it.

export const LEVEL_OVERRIDE_KEY = "syllabus_levels";
export const EXAM_OVERRIDE_KEY = "syllabus_exam_items";

export interface LevelOverride {
  level: number;        // 1–6
  name?: string;
  objective?: string;
}
export interface ExamItemOverride {
  fromLevel: number;    // which exam spec
  sectionKey: string;   // technical / footwork / tactical / physical
  index: number;        // 0-based item index within section
  label: string;
}

async function getValue<T>(key: string, fallback: T): Promise<T> {
  const db = createAdminClient();
  const { data } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value ?? fallback) as T;
}
async function setValue(key: string, value: unknown): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export const loadLevelOverrides = () => getValue<LevelOverride[]>(LEVEL_OVERRIDE_KEY, []);
export const saveLevelOverrides = (rows: LevelOverride[]) => setValue(LEVEL_OVERRIDE_KEY, rows);
export const loadExamItemOverrides = () => getValue<ExamItemOverride[]>(EXAM_OVERRIDE_KEY, []);
export const saveExamItemOverrides = (rows: ExamItemOverride[]) => setValue(EXAM_OVERRIDE_KEY, rows);

// Merged syllabus: defaults from training.ts overlaid with any admin overrides.
// `cache()` deduplicates the two DB reads within one server request. Each call
// returns NEW arrays so callers can safely mutate / sort.
export const loadSyllabus = cache(async (): Promise<{ levels: TrainingLevel[]; exams: ExamSpec[] }> => {
  const [levelOverrides, examOverrides] = await Promise.all([
    loadLevelOverrides(),
    loadExamItemOverrides(),
  ]);
  const lvByNum = new Map<number, LevelOverride>(
    (levelOverrides ?? []).map((o) => [Number(o.level), o]),
  );
  const levels: TrainingLevel[] = TRAINING_LEVELS.map((lv) => {
    const o = lvByNum.get(lv.level);
    return {
      ...lv,
      name: o?.name?.trim() || lv.name,
      objective: o?.objective?.trim() || lv.objective,
      groups: lv.groups.map((g) => ({ ...g, items: [...g.items] })),
    };
  });

  // Bucket exam-item overrides by (fromLevel, sectionKey, index).
  const exKey = (fl: number, sk: string, i: number) => `${fl}|${sk}|${i}`;
  const exMap = new Map<string, ExamItemOverride>(
    (examOverrides ?? []).map((o) => [exKey(Number(o.fromLevel), String(o.sectionKey), Number(o.index)), o]),
  );
  const exams: ExamSpec[] = EXAM_SPECS.map((spec) => ({
    ...spec,
    sections: spec.sections.map((sec) => ({
      ...sec,
      items: sec.items.map((it, i) => {
        const o = exMap.get(exKey(spec.fromLevel, sec.key, i));
        return { ...it, label: o?.label?.trim() || it.label };
      }),
    })),
  }));

  return { levels, exams };
});

// Convenience: just one slice when the caller only needs the level info.
export async function getLevelsMerged(): Promise<TrainingLevel[]> {
  return (await loadSyllabus()).levels;
}
export async function getExamSpecMerged(fromLevel: number): Promise<ExamSpec | null> {
  const exams = (await loadSyllabus()).exams;
  return exams.find((e) => e.fromLevel === fromLevel) ?? null;
}
export async function getLevelInfoMerged(level: number | null | undefined) {
  if (!level) return null;
  return (await loadSyllabus()).levels.find((l) => l.level === level) ?? null;
}
