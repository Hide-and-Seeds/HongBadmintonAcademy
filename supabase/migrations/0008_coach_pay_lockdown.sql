-- ============================================================================
-- 0008_coach_pay_lockdown.sql
-- Coach pay was a column on public.profiles, which every coach can read for
-- their OWN row via the profiles_select policy (id = auth.uid()). RLS is
-- row-level, so it can't hide a single column — a coach could read their rate
-- straight from the API. Move pay into a dedicated admin-only table so coaches
-- can no longer see it; admin pages keep working (admin / service role only).
-- ============================================================================

create table if not exists public.coach_pay (
  coach_id       uuid primary key references public.profiles(id) on delete cascade,
  pay_per_lesson numeric not null default 100,
  updated_at     timestamptz not null default now()
);

-- Carry over existing rates so nobody's pay resets.
insert into public.coach_pay (coach_id, pay_per_lesson)
  select id, pay_per_lesson from public.profiles where role = 'coach'
  on conflict (coach_id) do update set pay_per_lesson = excluded.pay_per_lesson;

alter table public.coach_pay enable row level security;

-- Admin-only. Service role bypasses RLS entirely (used by setCoachRate).
create policy coach_pay_select on public.coach_pay for select to authenticated
  using (public.is_admin());
create policy coach_pay_write on public.coach_pay for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Remove the exposed column now that the data lives in the locked-down table.
alter table public.profiles drop column if exists pay_per_lesson;
