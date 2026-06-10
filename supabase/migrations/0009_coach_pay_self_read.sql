-- ============================================================================
-- 0009_coach_pay_self_read.sql
-- Let each coach read their OWN pay row (for the coach-facing payroll page),
-- while still hiding every other coach's pay. Writes stay admin-only — a coach
-- can see their rate, not change it.
-- ============================================================================

drop policy if exists coach_pay_select on public.coach_pay;
create policy coach_pay_select on public.coach_pay for select to authenticated
  using (public.is_admin() or coach_id = auth.uid());
