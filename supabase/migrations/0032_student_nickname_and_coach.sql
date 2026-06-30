-- ============================================================================
-- 0032_student_nickname_and_coach.sql
-- Student nickname + assigned (personal) coach. The assigned coach is distinct
-- from the class coaches: it's the staff member responsible for the student.
-- ============================================================================
alter table public.students add column if not exists nickname text;
alter table public.students add column if not exists coach_id uuid references public.profiles(id) on delete set null;
create index if not exists idx_students_coach on public.students(coach_id);

-- Let the assigned coach read their student (branch/class/parent reads already
-- exist; this adds the assigned-coach path).
drop policy if exists students_select on public.students;
create policy students_select on public.students for select to authenticated
  using (
    public.admin_branch_ok(branch_id)
    or public.parent_of_student(id)
    or public.coach_of_student(id)
    or coach_id = auth.uid()
  );
