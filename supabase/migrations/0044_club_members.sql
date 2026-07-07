-- ============================================================================
-- 0044_club_members.sql : Club members (Phase 2a).
--
-- The club is a separate business ARM (see 0043). A member can be an academy
-- family (profile_id set) or standalone public (profile_id null). Their
-- membership tier is a club-side fee plan (fee_plans where business='club').
-- Invoices raised for a member carry business='club' + club_member_id, so club
-- dues flow straight into the /admin/pots report. Super-admin managed (club
-- finance), like court rentals.
-- ============================================================================

create table if not exists public.club_members (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid references public.branches(id) on delete set null,
  profile_id         uuid references public.profiles(id) on delete set null,
  full_name          text not null,
  email              text,
  phone              text,
  tier_id            uuid references public.fee_plans(id) on delete set null,
  status             text not null default 'active',
  stripe_customer_id text,
  joined_at          date not null default current_date,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint club_members_status_chk check (status in ('active','inactive'))
);
create index if not exists club_members_branch_idx on public.club_members(branch_id);
create index if not exists club_members_tier_idx   on public.club_members(tier_id);

-- Link a club invoice back to its member (academy invoices leave this null).
alter table public.invoices add column if not exists club_member_id uuid references public.club_members(id) on delete set null;
create index if not exists idx_invoices_club_member on public.invoices(club_member_id);

alter table public.club_members enable row level security;

-- Super-admin only (club finance). is_super_admin() ships from migration 0030.
create policy club_members_super_all on public.club_members for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
