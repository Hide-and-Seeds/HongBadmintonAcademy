-- ============================================================================
-- 0038_branch_tighten_secondary_rls.sql
-- P7 security pass: the P0 branch scoping covered the owned tables (students/
-- classes/sessions/invoices/payments). The child tables still used plain
-- is_admin(), letting a branch-admin read/write other branches' attendance,
-- enrolments, marks, check-ins, leaves and monthly assessments by direct API
-- call. Tighten the ADMIN portion of those policies to the parent row's branch;
-- coach/parent paths are unchanged. Super-admin passes everything.
-- ============================================================================

create or replace function public.admin_of_class(p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_branch_ok((select branch_id from public.classes where id = p_class));
$$;

create or replace function public.admin_of_session(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_branch_ok((select branch_id from public.sessions where id = p_session));
$$;

create or replace function public.admin_of_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_branch_ok((select branch_id from public.students where id = p_student));
$$;

-- attendance
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select to authenticated
  using (public.admin_of_session(session_id) or public.coach_of_student(student_id) or public.parent_of_student(student_id));
drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance for all to authenticated
  using (public.admin_of_session(session_id) or public.coach_of_student(student_id)
         or public.coach_of_makeup(student_id, session_id))
  with check (public.admin_of_session(session_id) or public.coach_of_student(student_id)
              or public.coach_of_makeup(student_id, session_id));

-- enrollments
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select to authenticated
  using (public.admin_of_class(class_id) or public.coach_of_class(class_id) or public.parent_of_student(student_id));
drop policy if exists enrollments_write on public.enrollments;
create policy enrollments_write on public.enrollments for all to authenticated
  using (public.admin_of_class(class_id)) with check (public.admin_of_class(class_id));

-- class_schedules
drop policy if exists schedules_select on public.class_schedules;
create policy schedules_select on public.class_schedules for select to authenticated
  using (
    public.admin_of_class(class_id)
    or public.coach_of_class(class_id)
    or exists (select 1 from public.enrollments e join public.students s on s.id = e.student_id
               where e.class_id = class_schedules.class_id and s.parent_id = auth.uid())
  );
drop policy if exists schedules_write on public.class_schedules;
create policy schedules_write on public.class_schedules for all to authenticated
  using (public.admin_of_class(class_id)) with check (public.admin_of_class(class_id));

-- class_coaches
drop policy if exists class_coaches_select on public.class_coaches;
create policy class_coaches_select on public.class_coaches for select to authenticated
  using (public.admin_of_class(class_id) or coach_id = auth.uid());
drop policy if exists class_coaches_write on public.class_coaches;
create policy class_coaches_write on public.class_coaches for all to authenticated
  using (public.admin_of_class(class_id)) with check (public.admin_of_class(class_id));

-- session_marks
drop policy if exists session_marks_select on public.session_marks;
create policy session_marks_select on public.session_marks for select to authenticated
  using (public.admin_of_session(session_id) or coach_id = auth.uid()
         or public.coach_of_student(student_id) or public.parent_of_student(student_id));
drop policy if exists session_marks_insert on public.session_marks;
create policy session_marks_insert on public.session_marks for insert to authenticated
  with check (public.admin_of_session(session_id)
              or (public.app_role() = 'coach'
                  and (public.coach_of_student(student_id) or public.coach_of_makeup(student_id, session_id))));
drop policy if exists session_marks_update on public.session_marks;
create policy session_marks_update on public.session_marks for update to authenticated
  using (public.admin_of_session(session_id) or coach_id = auth.uid()
         or public.coach_of_student(student_id) or public.coach_of_makeup(student_id, session_id))
  with check (public.admin_of_session(session_id) or coach_id = auth.uid()
              or public.coach_of_student(student_id) or public.coach_of_makeup(student_id, session_id));
drop policy if exists session_marks_delete on public.session_marks;
create policy session_marks_delete on public.session_marks for delete to authenticated
  using (public.admin_of_session(session_id) or coach_id = auth.uid());

-- coach_checkins
drop policy if exists coach_checkins_select on public.coach_checkins;
create policy coach_checkins_select on public.coach_checkins for select to authenticated
  using (public.admin_of_session(session_id) or coach_id = auth.uid());
drop policy if exists coach_checkins_insert on public.coach_checkins;
create policy coach_checkins_insert on public.coach_checkins for insert to authenticated
  with check (
    public.admin_of_session(session_id)
    or (coach_id = auth.uid()
        and exists (select 1 from public.sessions s where s.id = session_id and public.coach_of_class(s.class_id)))
  );
drop policy if exists coach_checkins_delete on public.coach_checkins;
create policy coach_checkins_delete on public.coach_checkins for delete to authenticated
  using (public.admin_of_session(session_id) or coach_id = auth.uid());

-- leave_requests (admin portion; coach read + service-role parent path unchanged)
drop policy if exists leave_requests_admin on public.leave_requests;
create policy leave_requests_admin on public.leave_requests for all to authenticated
  using (public.admin_of_session(session_id)) with check (public.admin_of_session(session_id));

-- coach_leave_requests (admin portion)
drop policy if exists coach_leave_admin on public.coach_leave_requests;
create policy coach_leave_admin on public.coach_leave_requests for all to authenticated
  using (public.admin_of_session(session_id)) with check (public.admin_of_session(session_id));

-- monthly_assessments
drop policy if exists monthly_assess_select on public.monthly_assessments;
create policy monthly_assess_select on public.monthly_assessments for select to authenticated
  using (public.admin_of_student(student_id) or coach_id = auth.uid()
         or public.coach_of_student(student_id) or public.parent_of_student(student_id));
drop policy if exists monthly_assess_write on public.monthly_assessments;
create policy monthly_assess_write on public.monthly_assessments for all to authenticated
  using (public.admin_of_student(student_id) or public.coach_of_student(student_id))
  with check (public.admin_of_student(student_id) or public.coach_of_student(student_id));
