"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { studentSchema } from "@/lib/validation";
import { RANK_ORDER, studentRank } from "@/lib/ranks";
import { levelToRank, levelName } from "@/lib/training";
import { sendRankUpNotice } from "@/lib/reminders";
import { recordRankChange } from "@/lib/rank-history";
import { uploadStudentPhoto } from "@/lib/storage";

const order = (r: string | null) => (r ? RANK_ORDER[r] ?? 0 : 0);

function err(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function revalidateRank(id: string) {
  revalidatePath(`/admin/students/${id}`);
  revalidatePath("/admin/people");
  revalidatePath("/admin/leaderboard");
}

// Admin: bump a student up by one training level (max 6). One-way only — there
// is no "set rank" or "demote" because the syllabus says <70 stays / retests,
// never drops. Coarse 4-rank (Beginner/Intermediate/Advanced/Elite) is derived
// from the new level via levelToRank so the leaderboard, badges and fee-tiers
// stay in sync. Coaches promote via /coach/exams; this is the manual override.
export async function promoteStudent(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const [{ data: s }, { data: enr }] = await Promise.all([
    supabase.from("students").select("rank, level").eq("id", id).maybeSingle(),
    supabase.from("enrollments").select("classes(level)").eq("student_id", id).eq("active", true),
  ]);
  const curLevel = Number((s as any)?.level ?? 1);
  if (curLevel >= 6) err(`/admin/students/${id}`, "Already at the top level (6 · Elite Team).");
  const nextLevel = curLevel + 1;

  const classLevels = (enr ?? []).map((e: any) => e.classes?.level ?? null);
  const prevRank = studentRank((s as any)?.rank, classLevels);
  const nextRankCoarse = levelToRank(nextLevel);

  const update: Record<string, unknown> = { level: nextLevel };
  // Only nudge the coarse rank UPWARD — never overwrite an admin-set higher tier.
  if (nextRankCoarse && order(nextRankCoarse) > order(prevRank)) update.rank = nextRankCoarse;

  const { error } = await supabase.from("students").update(update).eq("id", id);
  if (error) err(`/admin/students/${id}`, error.message);

  if (update.rank) {
    await recordRankChange(createAdminClient(), { student_id: id, from: prevRank, to: nextRankCoarse });
  }
  try { await sendRankUpNotice(id, `Level ${nextLevel} · ${levelName(nextLevel)}`); } catch { /* never block the promotion */ }
  revalidateRank(id);
}

export async function createStudent(formData: FormData) {
  await requireRole("admin");
  const raw = Object.fromEntries(formData);
  const parsed = studentSchema.safeParse(raw);
  if (!parsed.success) err("/admin/students/new", parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: created, error } = await supabase.from("students").insert(parsed.data).select("id").single();
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
  await requireRole("admin");
  const id = String(formData.get("id"));
  const raw = Object.fromEntries(formData);
  const parsed = studentSchema.safeParse(raw);
  if (!parsed.success) err(`/admin/students/${id}`, parsed.error.issues[0].message);

  const supabase = await createClient();
  const update: Record<string, unknown> = { ...parsed.data };
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const url = await uploadStudentPhoto(id, photo);
    if (url) update.photo_url = url;
  }
  const { error } = await supabase.from("students").update(update).eq("id", id);
  if (error) err(`/admin/students/${id}`, error.message);

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
