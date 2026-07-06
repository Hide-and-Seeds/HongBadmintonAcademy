-- ============================================================================
-- 0037_profile_locale.sql
-- Per-user language. 'en' (default) or 'zh' (Simplified Chinese). Drives the
-- parent-facing UI first; admin/coach translation can follow later.
-- ============================================================================
alter table public.profiles add column if not exists locale text not null default 'en'
  check (locale in ('en','zh'));
