-- ============================================================================
-- 0033_coach_checkins.sql
-- Coach self-check-in: did the coach actually show up to their session? One row
-- per (session, coach). Distinct from student attendance.
-- ============================================================================
create table if not exists public.coach_checkins (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id)  on delete cascade,
  coach_id      uuid not null references public.profiles(id)  on delete cascade,
  checked_in_at timestamptz not null default now(),
  method        text not null default 'self',   -- 'self' | 'admin'
  unique (session_id, coach_id)
);
create index if not exists idx_coach_checkins_session on public.coach_checkins(session_id);
create index if not exists idx_coach_checkins_coach   on public.coach_checkins(coach_id);

alter table public.coach_checkins enable row level security;

-- Read: any admin, or the coach themselves.
drop policy if exists coach_checkins_select on public.coach_checkins;
create policy coach_checkins_select on public.coach_checkins for select to authenticated
  using (public.is_admin() or coach_id = auth.uid());

-- Check in: a coach for a session of their own class, or an admin for anyone.
drop policy if exists coach_checkins_insert on public.coach_checkins;
create policy coach_checkins_insert on public.coach_checkins for insert to authenticated
  with check (
    public.is_admin()
    or (coach_id = auth.uid()
        and exists (select 1 from public.sessions s where s.id = session_id and public.coach_of_class(s.class_id)))
  );

-- Undo: the coach themselves, or an admin.
drop policy if exists coach_checkins_delete on public.coach_checkins;
create policy coach_checkins_delete on public.coach_checkins for delete to authenticated
  using (public.is_admin() or coach_id = auth.uid());
