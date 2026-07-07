"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setParentSessionCookie } from "@/lib/parent-auth";
import { homeForRole, isAdminRole } from "@/lib/auth";
import type { Role } from "@/lib/types";

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
  const role = prof?.role as Role | undefined;

  if (role === "parent") {
    await supabase.auth.signOut({ scope: "local" }); // parents use the hba_parent cookie
    await setParentSessionCookie(user.id);
    redirect(next || "/parent");
  }
  if (role && (isAdminRole(role) || role === "coach")) {
    // If they have 2FA on, the password only got them to aal1 — finish the
    // second factor before landing anywhere.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
      const p = new URLSearchParams();
      if (next) p.set("next", next);
      redirect(`/login/2fa${p.toString() ? `?${p.toString()}` : ""}`);
    }
    redirect(next || homeForRole(role));
  }

  // Authenticated but no usable profile/role.
  await supabase.auth.signOut({ scope: "local" });
  fail("This account has no access yet. Contact the academy.");
}
