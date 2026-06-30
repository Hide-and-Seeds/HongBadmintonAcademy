-- ============================================================================
-- 0030_super_admin_role.sql
-- Add the super_admin tier. Kept in its OWN migration (committed before any
-- later migration/policy references it) because Postgres forbids using a freshly
-- added enum value in the same transaction that added it.
-- ============================================================================
alter type public.user_role add value if not exists 'super_admin';
