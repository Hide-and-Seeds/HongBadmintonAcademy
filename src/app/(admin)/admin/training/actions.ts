"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  loadLevelOverrides, saveLevelOverrides,
  loadExamItemOverrides, saveExamItemOverrides,
  type LevelOverride, type ExamItemOverride,
} from "@/lib/syllabus";
import { TRAINING_LEVELS, EXAM_SPECS } from "@/lib/training";

function back(message?: string): never {
  redirect(message ? `/admin/training?error=${encodeURIComponent(message)}` : "/admin/training?saved=1");
}

// Save every per-level override in one shot. An empty string clears that field
// (loadSyllabus then falls back to the hardcoded default).
export async function saveLevelEdits(formData: FormData) {
  await requireRole("admin");
  const rows: LevelOverride[] = [];
  for (const lv of TRAINING_LEVELS) {
    const name = (formData.get(`name_${lv.level}`) as string)?.trim() ?? "";
    const objective = (formData.get(`obj_${lv.level}`) as string)?.trim() ?? "";
    // Only keep an override row if it actually differs from the default; that
    // way clearing the field reverts cleanly instead of pinning the default.
    if ((name && name !== lv.name) || (objective && objective !== lv.objective)) {
      rows.push({
        level: lv.level,
        name: name && name !== lv.name ? name : undefined,
        objective: objective && objective !== lv.objective ? objective : undefined,
      });
    }
  }
  try {
    await saveLevelOverrides(rows);
  } catch (e) {
    back((e as Error).message);
  }
  revalidatePath("/admin/training");
  back();
}

// Save every per-exam-item label override in one shot. Item maxes stay locked
// (changing them would invalidate score history).
export async function saveExamLabelEdits(formData: FormData) {
  await requireRole("admin");
  const rows: ExamItemOverride[] = [];
  for (const spec of EXAM_SPECS) {
    for (const sec of spec.sections) {
      sec.items.forEach((it, i) => {
        const field = `ex_${spec.fromLevel}_${sec.key}_${i}`;
        const label = (formData.get(field) as string)?.trim() ?? "";
        if (label && label !== it.label) {
          rows.push({ fromLevel: spec.fromLevel, sectionKey: sec.key, index: i, label });
        }
      });
    }
  }
  try {
    await saveExamItemOverrides(rows);
  } catch (e) {
    back((e as Error).message);
  }
  revalidatePath("/admin/training");
  back();
}

export async function resetSyllabusOverrides() {
  await requireRole("admin");
  try {
    await saveLevelOverrides([]);
    await saveExamItemOverrides([]);
  } catch (e) {
    back((e as Error).message);
  }
  revalidatePath("/admin/training");
  back();
}

// Read-only helpers for the editor page (kept here so the page is a pure RSC).
export async function loadEditorState() {
  await requireRole("admin");
  const [levels, items] = await Promise.all([loadLevelOverrides(), loadExamItemOverrides()]);
  return { levelOverrides: levels, examOverrides: items };
}
