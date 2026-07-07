-- Recurring club dues (2c). One auto-raised invoice per member per month per
-- tier — dedupes repeated cron runs / the manual "Generate" button. Partial so
-- it only covers club-member invoices and never collides with the student
-- recurring index (uq_invoices_student_period_plan).

create unique index if not exists uq_invoices_club_member_period_plan
  on public.invoices(club_member_id, period_month, fee_plan_id)
  where club_member_id is not null;
