"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { resolveWriteBranch } from "@/lib/branch";
import { studentSchema } from "@/lib/validation";
import { levelName } from "@/lib/training";
import { sendRankUpNotice } from "@/lib/reminders";
import { recordRankChange } from "@/lib/rank-history";
import { uploadStudentPhoto } from "@/lib/storage";

function err(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

// Clamp a form level field to the 1–6 ladder (default 1).
function clampLevel(v: FormDataEntryValue | null): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(6, Math.max(1, n)) : 1;
}

function revalidateRank(id: string) {
  revalidatePath(`/admin/students/${id}`);
  revalidatePath("/admin/people");
  revalidatePath("/admin/leaderboard");
}

// Admin: bump a student up by one training level (max 6). One-way only — the
// syllabus says <70 stays / retests, never drops. `students.level` is the single
// ladder (the old 4-tier rank was retired); the change is logged to rank_events
// as level NAMES so the parent "promoted" timeline still works.
export async function promoteStudent(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { data: s } = await supabase.from("students").select("level").eq("id", id).maybeSingle();
  const curLevel = Number((s as any)?.level ?? 1);
  if (curLevel >= 6) err(`/admin/students/${id}`, "Already at the top level (6 · Elite Team).");
  const nextLevel = curLevel + 1;

  const { error } = await supabase.from("students").update({ level: nextLevel }).eq("id", id);
  if (error) err(`/admin/students/${id}`, error.message);

  await recordRankChange(createAdminClient(), { student_id: id, from: levelName(curLevel), to: levelName(nextLevel) });
  try { await sendRankUpNotice(id, `Level ${nextLevel} · ${levelName(nextLevel)}`); } catch { /* never block the promotion */ }
  revalidateRank(id);
}

export async function createStudent(formData: FormData) {
  const me = await requireRole("admin");
  const raw = Object.fromEntries(formData);
  const parsed = studentSchema.safeParse(raw);
  if (!parsed.success) err("/admin/students/new", parsed.error.issues[0].message);

  const supabase = await createClient();
  // Branch is stamped authoritatively: a branch-admin can only create in their
  // own branch; a super-admin uses the chosen one (RLS also enforces this).
  const branch_id = resolveWriteBranch(me, parsed.data.branch_id);
  const level = clampLevel(formData.get("level"));
  const { data: created, error } = await supabase.from("students").insert({ ...parsed.data, branch_id, level }).select("id").single();
  if (error) err("/admin/students/new", error.message);

  const photo = formData.get("photo");
  if (created && photo instanceof File && photo.size > 0) {
    const url = await uploadStudentPhoto(created.id, photo);
    if (url) await supabase.from("students").update({ photo_url: url }).eq("id", created.id);
  }

  revalidatePath("/admin/students");
  redirect("/admin/students");
}

export async function updateStudent(formData: FormData) {
  const me = await requireRole("admin");
  const id = String(formData.get("id"));
  const raw = Object.fromEntries(formData);
  const parsed = studentSchema.safeParse(raw);
  if (!parsed.success) err(`/admin/students/${id}`, parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: before } = await supabase.from("students").select("level").eq("id", id).maybeSingle();
  const oldLevel = Number((before as any)?.level ?? 1);
  const newLevel = clampLevel(formData.get("level"));

  const update: Record<string, unknown> = {
    ...parsed.data,
    branch_id: resolveWriteBranch(me, parsed.data.branch_id),
    level: newLevel,
  };
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const url = await uploadStudentPhoto(id, photo);
    if (url) update.photo_url = url;
  }
  const { error } = await supabase.from("students").update(update).eq("id", id);
  if (error) err(`/admin/students/${id}`, error.message);

  // An admin editing the level directly is a real promotion/correction — log it
  // to rank_events (level NAMES) and, on an increase, notify the parent.
  if (newLevel !== oldLevel) {
    try {
      await recordRankChange(createAdminClient(), { student_id: id, from: levelName(oldLevel), to: levelName(newLevel) });
      if (newLevel > oldLevel) await sendRankUpNotice(id, `Level ${newLevel} · ${levelName(newLevel)}`);
    } catch { /* never block the edit on a notify/log failure */ }
  }

  revalidatePath("/admin/students");
  redirect("/admin/students");
}

export async function deleteStudent(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("students").delete().eq("id", id);
  revalidatePath("/admin/students");
}

export async function deleteStudents(formData: FormData) {
  await requireRole("admin");
  const ids = formData.getAll("ids").map(String);
  if (!ids.length) return;
  const supabase = await createClient();
  await supabase.from("students").delete().in("id", ids);
  revalidatePath("/admin/students");
}

// Reward system: award points to a student (optionally tied to a rule).
export async function awardReward(formData: FormData) {
  await requireRole("admin");
  const student_id = String(formData.get("student_id"));
  const points = Number(formData.get("points"));
  const rule_id = (formData.get("rule_id") as string) || null;
  const reason = (formData.get("reason") as string)?.trim() || null;
  if (!points || Number.isNaN(points)) {
    err(`/admin/students/${student_id}`, "Enter a non-zero points value");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("reward_ledger").insert({
    student_id,
    rule_id,
    points,
    reason,
    awarded_by: user?.id ?? null,
  });
  if (error) err(`/admin/students/${student_id}`, error.message);

  revalidatePath(`/admin/students/${student_id}`);
}
