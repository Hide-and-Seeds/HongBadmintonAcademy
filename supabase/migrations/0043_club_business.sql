-- ============================================================================
-- 0043_club_business.sql : "business" arm tag for the Club vs Academy split.
--
-- One legal entity, one Stripe account, one bank — the split is a TAG, not a
-- separate account. Every fee plan / invoice / payment carries business =
-- 'academy' | 'club' so revenue, pots and the combined P&L can be reported per
-- arm. Additive + default 'academy', so all existing rows and billing flows are
-- unchanged.
-- ============================================================================

alter table public.fee_plans add column if not exists business text not null default 'academy';
alter table public.invoices  add column if not exists business text not null default 'academy';
alter table public.payments  add column if not exists business text not null default 'academy';

alter table public.fee_plans drop constraint if exists fee_plans_business_chk;
alter table public.fee_plans add constraint fee_plans_business_chk check (business in ('academy','club'));
alter table public.invoices  drop constraint if exists invoices_business_chk;
alter table public.invoices  add constraint invoices_business_chk check (business in ('academy','club'));
alter table public.payments  drop constraint if exists payments_business_chk;
alter table public.payments  add constraint payments_business_chk check (business in ('academy','club'));

create index if not exists idx_invoices_business on public.invoices(business);
create index if not exists idx_payments_business on public.payments(business);
