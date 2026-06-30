import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Branch, Profile } from "@/lib/types";

export const BRANCH_VIEW_COOKIE = "hba_branch";

// The super-admin's chosen "viewing" branch — an app-layer convenience that
// narrows list/dashboard reads to one branch. Returns a branch id, or null for
// "all branches". Branch-admins are already RLS-scoped to their own branch, so
// this returns null for them (no extra filter needed). NEVER a security
// boundary — RLS is — so a missed page just shows all, never another branch.
export async function getViewBranchId(me: Profile): Promise<string | null> {
  if (me.role !== "super_admin") return null;
  const v = (await cookies()).get(BRANCH_VIEW_COOKIE)?.value;
  return v && v !== "all" ? v : null;
}

// Active branches for selectors/filters. Service-role read (branch names aren't
// sensitive); callers that render this are already admin-gated.
export async function listBranches(activeOnly = true): Promise<Branch[]> {
  const db = createAdminClient();
  let q = db.from("branches").select("*").order("name");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return (data as Branch[]) ?? [];
}

// Only super-admins may choose which branch a record belongs to; a branch-admin
// is always pinned to their own branch.
export function canChooseBranch(me: Profile): boolean {
  return me.role === "super_admin";
}

// The authoritative branch_id to stamp on a write by `me`. Never trust the
// submitted value for a branch-admin — force their own branch. A super-admin may
// pick any branch; falls back to their own when none is chosen.
export function resolveWriteBranch(me: Profile, chosen?: string | null): string | null {
  if (me.role === "super_admin") return (chosen && chosen.trim()) || me.branch_id || null;
  return me.branch_id ?? null;
}
