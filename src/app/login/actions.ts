"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setParentSessionCookie } from "@/lib/parent-auth";
import { homeForRole } from "@/lib/auth";

// One login for everyone. Verify the password against Supabase Auth, then route
// by role: parents run on the app's own 1-year cookie (so we drop the Supabase
// session), while staff keep their Supabase session.
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rawNext = (formData.get("next") as string) || "";
  // Only allow internal redirects — block open-redirect to other origins.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";

  function fail(msg: string): never {
    const p = new URLSearchParams({ error: msg });
    if (next) p.set("next", next);
    redirect(`/login?${p.toString()}`);
  }
  if (!email || !password) fail("Enter your email and password.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const user = data?.user;
  if (error || !user) fail("Wrong email or password.");

  const db = createAdminClient();
  const { data: prof } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = prof?.role as "admin" | "coach" | "parent" | undefined;

  if (role === "parent") {
    await supabase.auth.signOut({ scope: "local" }); // parents use the hba_parent cookie
    await setParentSessionCookie(user.id);
    redirect(next || "/parent");
  }
  if (role === "admin" || role === "coach") {
    redirect(next || homeForRole(role));
  }

  // Authenticated but no usable profile/role.
  await supabase.auth.signOut({ scope: "local" });
  fail("This account has no access yet. Contact the academy.");
}
