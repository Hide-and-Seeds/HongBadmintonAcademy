"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  full_name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().optional().transform((v) => (v ? v : null)),
});

// Update the currently signed-in user's own profile (RLS allows id = auth.uid()).
export async function updateOwnProfile(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin/settings?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}
