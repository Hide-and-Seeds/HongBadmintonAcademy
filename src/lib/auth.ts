import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile, Role } from "@/lib/types";

// Resolve the current user's profile (or null). Returns null when Supabase
// isn't configured yet so pages can render a setup notice instead of crashing.
export async function getProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

// super_admin is a strict superset of admin — it satisfies every "admin" gate.
export function isAdminRole(role: Role): boolean {
  return role === "admin" || role === "super_admin";
}

// Default landing path for a role.
export function homeForRole(role: Role): string {
  return isAdminRole(role) ? "/admin" : role === "coach" ? "/coach" : "/parent";
}

// Guard a page to one or more roles. Redirects to /login when signed out, or to
// the user's own home when their role isn't allowed. A page that allows "admin"
// implicitly allows "super_admin" too (super = admin++).
export async function requireRole(
  allowed: Role | Role[],
): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const roles = Array.isArray(allowed) ? [...allowed] : [allowed];
  if (roles.includes("admin") && !roles.includes("super_admin")) roles.push("super_admin");
  if (!roles.includes(profile.role)) redirect(homeForRole(profile.role));

  return profile;
}

// Guard a super-admin-only page or action (branches, staff, settings, refunds,
// fee-plan pricing). Redirects a plain admin/coach/parent back to their home.
export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "super_admin") redirect(homeForRole(profile.role));
  return profile;
}
