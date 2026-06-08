-- ============================================================================
-- 0005_stripe.sql : Stripe linkage columns (additive, nullable — safe).
--   profiles.stripe_customer_id  : reuse one Stripe Customer per parent
--   fee_plans.stripe_product_id  : catalog Product mirrored from a fee plan
--   fee_plans.stripe_price_id    : catalog Price mirrored from a fee plan
-- ============================================================================

alter table public.profiles  add column if not exists stripe_customer_id text;
alter table public.fee_plans add column if not exists stripe_product_id  text;
alter table public.fee_plans add column if not exists stripe_price_id    text;

create index if not exists idx_profiles_stripe_customer
  on public.profiles(stripe_customer_id);
