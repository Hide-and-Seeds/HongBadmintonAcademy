-- ============================================================================
-- 0054_null_admin_branch.sql
-- Owner change 2026-07-09: admins no longer carry a home branch — they span
-- all branches (super and regular alike). Only coaches (and existing parents,
-- via unrelated logic) keep profiles.branch_id populated.
--
-- Null-out any legacy branch on admin / super_admin rows. The column itself
-- stays (still used for coaches). Reversible by re-stamping if branch-admins
-- ever come back.
-- ============================================================================

update public.profiles
   set branch_id = null
 where role in ('admin', 'super_admin')
   and branch_id is not null;
