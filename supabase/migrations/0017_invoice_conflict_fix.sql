-- Fix recurring-invoice upsert. supabase-js .upsert({onConflict}) passes only
-- column names, so Postgres cannot infer a PARTIAL unique index and raises
-- "no unique or exclusion constraint matching the ON CONFLICT specification".
-- Replace the partial index with a full unique index on the same columns. Rows
-- with fee_plan_id IS NULL remain unconstrained (NULLs are distinct), so manual
-- one-off invoices are unaffected.
drop index if exists public.uq_invoices_student_period_plan;
create unique index if not exists uq_invoices_student_period_plan
  on public.invoices(student_id, period_month, fee_plan_id);
