-- ============================================================================
-- 0023_parent_pin.sql  —  Parent PIN auth + one-time login tokens
--
-- Proposal v7 §7.2/7.3: parents never type an email/password. Admin generates a
-- one-time login link; parent taps it; sets a 4-digit PIN. Persistent 1-year
-- cookie session means the PIN screen is rare. Edge-case re-auth is phone +
-- PIN. Five wrong PINs = locked until admin unlocks.
-- ============================================================================

-- ─── PIN columns on profiles ─────────────────────────────────────────────────
alter table public.profiles
  add column if not exists pin_hash        text,
  add column if not exists pin_set_at      timestamptz,
  add column if not exists pin_failed_count integer not null default 0,
  add column if not exists pin_locked_at   timestamptz;

-- Phone lookup needs to be fast at PIN entry time.
create index if not exists profiles_phone_idx on public.profiles (phone);

-- ─── One-time login tokens ───────────────────────────────────────────────────
create table if not exists public.parent_login_tokens (
  id         uuid primary key default gen_random_uuid(),
  token      text unique not null,        -- random url-safe, 32+ chars
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists parent_login_tokens_profile_idx
  on public.parent_login_tokens (profile_id, created_at desc);

-- Service-role bypasses RLS, so RLS here is just "deny everything to clients".
alter table public.parent_login_tokens enable row level security;

drop policy if exists parent_login_tokens_admin_read on public.parent_login_tokens;
create policy parent_login_tokens_admin_read on public.parent_login_tokens
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );
