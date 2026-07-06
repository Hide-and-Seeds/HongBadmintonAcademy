"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireParent } from "@/lib/parent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLocale } from "@/lib/i18n";

// Parent picks their app language. Service-role write scoped to the
// cookie-resolved parent id (parents have no Supabase session).
export async function setParentLocale(formData: FormData) {
  const me = await requireParent();
  const locale = normalizeLocale(String(formData.get("locale")));
  const db = createAdminClient();
  await db.from("profiles").update({ locale }).eq("id", me.id);
  revalidatePath("/parent", "layout");
  redirect("/parent/account?saved=locale");
}
