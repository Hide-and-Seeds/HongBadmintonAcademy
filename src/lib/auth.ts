import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { is2faRequired } from "@/lib/settings";
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

// Two-factor gate: if this staff session has a verified TOTP factor but hasn't
// cleared the 2nd factor this session (aal1, next aal2), bounce to /login/2fa.
// Enforced in requireRole/requireSuperAdmin so it guards BOTH page renders AND
// server actions (actions are standalone endpoints — see authz Invariant 1).
async function enforceStaffMfa(): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!data) return;
  // Has a factor but hasn't cleared it this session → verify.
  if (data.currentLevel === "aal1" && data.nextLevel === "aal2") redirect("/login/2fa");
  // No factor at all, but the academy requires 2FA → force enrollment first.
  if (data.nextLevel === "aal1" && (await is2faRequired())) redirect("/login/2fa/setup");
}

// Guard a page to one or more roles. Redirects to /login when signed out, or to
// the user's own home when their role isn't allowed. A page that allows "admin"
// implicitly allows "super_admin" too (super = admin++). `skipMfa` is for the
// 2FA enrol/verify actions themselves (which run before the factor is cleared).
export async function requireRole(
  allowed: Role | Role[],
  opts?: { skipMfa?: boolean },
): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const roles = Array.isArray(allowed) ? [...allowed] : [allowed];
  if (roles.includes("admin") && !roles.includes("super_admin")) roles.push("super_admin");
  if (!roles.includes(profile.role)) redirect(homeForRole(profile.role));

  if (!opts?.skipMfa && profile.role !== "parent") await enforceStaffMfa();
  return profile;
}

// Guard a super-admin-only page or action (branches, staff, settings, refunds,
// fee-plan pricing). Redirects a plain admin/coach/parent back to their home.
export async function requireSuperAdmin(opts?: { skipMfa?: boolean }): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "super_admin") redirect(homeForRole(profile.role));
  if (!opts?.skipMfa) await enforceStaffMfa();
  return profile;
}
