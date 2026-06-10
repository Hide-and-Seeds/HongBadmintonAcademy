"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { studentSchema } from "@/lib/validation";

function err(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createStudent(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = studentSchema.safeParse(raw);
  if (!parsed.success) err("/admin/students/new", parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert(parsed.data);
  if (error) err("/admin/students/new", error.message);

  revalidatePath("/admin/students");
  redirect("/admin/students");
}

export async function updateStudent(formData: FormData) {
  const id = String(formData.get("id"));
  const raw = Object.fromEntries(formData);
  const parsed = studentSchema.safeParse(raw);
  if (!parsed.success) err(`/admin/students/${id}`, parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("students").update(parsed.data).eq("id", id);
  if (error) err(`/admin/students/${id}`, error.message);

  revalidatePath("/admin/students");
  redirect("/admin/students");
}

export async function deleteStudent(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("students").delete().eq("id", id);
  revalidatePath("/admin/students");
}

export async function deleteStudents(formData: FormData) {
  const ids = formData.getAll("ids").map(String);
  if (!ids.length) return;
  const supabase = await createClient();
  await supabase.from("students").delete().in("id", ids);
  revalidatePath("/admin/students");
}

// Reward system: award points to a student (optionally tied to a rule).
export async function awardReward(formData: FormData) {
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
