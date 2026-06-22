"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { studentSchema } from "@/lib/validation";
import { CLASS_RANKS, RANK_ORDER, studentRank, nextRank } from "@/lib/ranks";
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

// Admin: set a student's rank directly (empty → revert to class-derived).
export async function setStudentRank(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id"));
  const raw = String(formData.get("rank") ?? "").trim();
  const rank = (CLASS_RANKS as readonly string[]).includes(raw) ? raw : null;
  const supabase = await createClient();

  // Effective rank before vs after, to congratulate only on a genuine rank-up.
  const [{ data: cur }, { data: enr }] = await Promise.all([
    supabase.from("students").select("rank").eq("id", id).maybeSingle(),
    supabase.from("enrollments").select("classes(level)").eq("student_id", id).eq("active", true),
  ]);
  const levels = (enr ?? []).map((e: any) => e.classes?.level ?? null);
  const prev = studentRank(cur?.rank, levels);

  const { error } = await supabase.from("students").update({ rank }).eq("id", id);
  if (error) err(`/admin/students/${id}`, error.message);

  const next = studentRank(rank, levels);
  await recordRankChange(createAdminClient(), { student_id: id, from: prev, to: next });
  if (order(next) > order(prev)) {
    try { await sendRankUpNotice(id, next); } catch { /* never block the rank change */ }
  }
  revalidateRank(id);
}

// Admin: bump a student one tier above their current effective rank.
export async function promoteStudent(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const [{ data: s }, { data: enr }] = await Promise.all([
    supabase.from("students").select("rank").eq("id", id).maybeSingle(),
    supabase.from("enrollments").select("classes(level)").eq("student_id", id).eq("active", true),
  ]);
  const levels = (enr ?? []).map((e: any) => e.classes?.level ?? null);
  const prev = studentRank(s?.rank, levels);
  const promoted = nextRank(prev);
  if (!promoted) err(`/admin/students/${id}`, "Already at the top rank (Elite).");
  const { error } = await supabase.from("students").update({ rank: promoted }).eq("id", id);
  if (error) err(`/admin/students/${id}`, error.message);
  await recordRankChange(createAdminClient(), { student_id: id, from: prev, to: promoted });
  try { await sendRankUpNotice(id, promoted); } catch { /* never block the promotion */ }
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
