-- ============================================================================
-- 0040_mfa_backup_codes.sql
-- One-time backup codes for staff 2FA recovery (lost authenticator). Stored
-- hashed. Only the service-role client touches this (enrollment writes them,
-- login recovery consumes them) — so RLS is on with no policies.
-- ============================================================================
create table if not exists public.mfa_backup_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_mfa_backup_user on public.mfa_backup_codes(user_id);
alter table public.mfa_backup_codes enable row level security;
