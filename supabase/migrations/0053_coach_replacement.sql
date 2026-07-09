-- ============================================================================
-- 0053_coach_replacement.sql
-- Coach-leave "replacement coach": when admin approves a coach's leave they can
-- now nominate another coach to cover that single session. Storage + a new RLS
-- predicate (coach_of_replacement) that lets the substitute pass every existing
-- attendance-write gate ONLY for that session — without touching the class's
-- lead/co-coach lists (which would give them class-wide access forever).
-- ============================================================================

-- 1) Which coach was assigned to cover this leave. Nullable — leave may still
--    be approved without a cover (e.g. class canceled instead).
alter table public.coach_leave_requests
  add column if not exists replacement_coach_id uuid
    references public.profiles(id) on delete set null;

create index if not exists idx_coach_leave_replacement
  on public.coach_leave_requests(replacement_coach_id)
  where replacement_coach_id is not null;

-- 2) Session-scoped authority predicate for the substitute. True iff the caller
--    is the approved replacement on an approved coach_leave for this session.
--    security definer to bypass RLS on coach_leave_requests when checking.
create or replace function public.coach_of_replacement(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.coach_leave_requests clr
    where clr.session_id = p_session
      and clr.status = 'approved'
      and clr.replacement_coach_id = auth.uid()
  );
$$;

-- 3) Let the substitute SELECT the sessions row for the covered session (and
--    only that one). Add to sessions_select — coach_of_replacement is per
--    session, so exposure is exactly one row.
drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions for select to authenticated
  using (
    public.admin_branch_ok(branch_id)
    or public.coach_of_class(class_id)
    or public.coach_of_replacement(id)
    or exists (select 1 from public.enrollments e join public.students s on s.id = e.student_id
               where e.class_id = sessions.class_id and s.parent_id = auth.uid())
  );

-- 4) Let the substitute READ enrollments for THAT session's class (needed to
--    render the roster on the check-in board).
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select to authenticated
  using (
    public.admin_of_class(class_id)
    or public.coach_of_class(class_id)
    or public.parent_of_student(student_id)
    or exists (select 1 from public.coach_leave_requests clr
               join public.sessions s on s.id = clr.session_id
               where clr.status = 'approved'
                 and clr.replacement_coach_id = auth.uid()
                 and s.class_id = enrollments.class_id)
  );

-- 5) Let the substitute mark attendance for the covered session's roster.
drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance for all to authenticated
  using (
    public.admin_of_session(session_id)
    or public.coach_of_student(student_id)
    or public.coach_of_makeup(student_id, session_id)
    or public.coach_of_replacement(session_id)
  )
  with check (
    public.admin_of_session(session_id)
    or public.coach_of_student(student_id)
    or public.coach_of_makeup(student_id, session_id)
    or public.coach_of_replacement(session_id)
  );

-- Read alongside write so the sub sees any prior/other-coach marks on that row.
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select to authenticated
  using (
    public.admin_of_session(session_id)
    or public.coach_of_student(student_id)
    or public.parent_of_student(student_id)
    or public.coach_of_replacement(session_id)
  );

-- 6) Session-marks (per-student rating). Let the sub insert/update rows they
--    author, and read marks on the covered session.
drop policy if exists session_marks_select on public.session_marks;
create policy session_marks_select on public.session_marks for select to authenticated
  using (
    public.admin_of_session(session_id)
    or coach_id = auth.uid()
    or public.coach_of_student(student_id)
    or public.parent_of_student(student_id)
    or public.coach_of_replacement(session_id)
  );

drop policy if exists session_marks_insert on public.session_marks;
create policy session_marks_insert on public.session_marks for insert to authenticated
  with check (
    public.admin_of_session(session_id)
    or (public.app_role() = 'coach'
        and (public.coach_of_student(student_id)
             or public.coach_of_makeup(student_id, session_id)
             or public.coach_of_replacement(session_id)))
  );

drop policy if exists session_marks_update on public.session_marks;
create policy session_marks_update on public.session_marks for update to authenticated
  using (
    public.admin_of_session(session_id)
    or coach_id = auth.uid()
    or public.coach_of_student(student_id)
    or public.coach_of_makeup(student_id, session_id)
    or public.coach_of_replacement(session_id)
  )
  with check (
    public.admin_of_session(session_id)
    or coach_id = auth.uid()
    or public.coach_of_student(student_id)
    or public.coach_of_makeup(student_id, session_id)
    or public.coach_of_replacement(session_id)
  );

-- 7) Coach check-in (self "I'm here" flag) — the sub should be able to tick it
--    for the covered session.
drop policy if exists coach_checkins_insert on public.coach_checkins;
create policy coach_checkins_insert on public.coach_checkins for insert to authenticated
  with check (
    public.admin_of_session(session_id)
    or (coach_id = auth.uid()
        and (
          exists (select 1 from public.sessions s where s.id = session_id and public.coach_of_class(s.class_id))
          or public.coach_of_replacement(session_id)
        ))
  );

-- 8) Let the sub SELECT their own replacement rows on coach_leave_requests
--    (needed for the coach schedule badge + dashboard hint).
drop policy if exists coach_leave_self_read on public.coach_leave_requests;
create policy coach_leave_self_read on public.coach_leave_requests for select to authenticated
  using (coach_id = auth.uid() or replacement_coach_id = auth.uid());
