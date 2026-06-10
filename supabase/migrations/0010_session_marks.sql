-- ============================================================================
-- 0010_session_marks.sql
-- Move the quick 1–5 coach mark from weekly to PER-SESSION, so coaches mark
-- right after each session (freshest memory) from the attendance screen instead
-- of recalling a whole week at week's end. Weekly/monthly views roll these up.
-- weekly_marks had no rows, so this is a clean cutover (no data migration).
-- ============================================================================

create table if not exists public.session_marks (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id)  on delete cascade,
  student_id  uuid not null references public.students(id)  on delete cascade,
  coach_id    uuid references public.profiles(id) on delete set null,
  rating      smallint not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (session_id, student_id)                  -- one mark per student per session (upsert)
);
create index if not exists idx_session_marks_student on public.session_marks(student_id);
create index if not exists idx_session_marks_session on public.session_marks(session_id);

drop trigger if exists session_marks_set_updated_at on public.session_marks;
create trigger session_marks_set_updated_at
  before update on public.session_marks
  for each row execute procedure moddatetime(updated_at);

-- ─── RLS (mirrors weekly_marks) ──────────────────────────────────────────────
alter table public.session_marks enable row level security;

create policy session_marks_select on public.session_marks for select to authenticated
  using (public.is_admin() or coach_id = auth.uid()
         or public.coach_of_student(student_id) or public.parent_of_student(student_id));

create policy session_marks_insert on public.session_marks for insert to authenticated
  with check (public.is_admin() or (public.app_role() = 'coach' and public.coach_of_student(student_id)));

create policy session_marks_update on public.session_marks for update to authenticated
  using (public.is_admin() or coach_id = auth.uid() or public.coach_of_student(student_id))
  with check (public.is_admin() or coach_id = auth.uid() or public.coach_of_student(student_id));

create policy session_marks_delete on public.session_marks for delete to authenticated
  using (public.is_admin() or coach_id = auth.uid());

-- Replace the weekly table (empty — nothing to carry over).
drop table if exists public.weekly_marks;
