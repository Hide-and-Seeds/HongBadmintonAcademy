-- ============================================================================
-- 0056_fix_sessions_rls_recursion.sql : HOTFIX — break sessions↔enrollments
-- RLS recursion introduced by 0053.
--
-- 0053 (coach replacement) added `join public.sessions s` into the
-- enrollments_select USING clause. But sessions_select already contains a
-- correlated `exists (select ... from enrollments ...)`. Under RLS, each
-- policy's subquery triggers the OTHER table's policy, so evaluating either
-- one loops forever:
--
--   sessions_select → (subquery on enrollments) → enrollments_select
--                   → (join on sessions)        → sessions_select → …
--
-- Postgres aborts with: "infinite recursion detected in policy for relation
-- \"sessions\"". Result: EVERY authenticated read of sessions errors and
-- returns nothing — the whole session calendar looks empty for admins, coaches
-- and parents (service-role reads bypass RLS, so the data itself is untouched).
--
-- Fix: move the sessions-touching branch of enrollments_select into a
-- SECURITY DEFINER function. A definer function runs with the owner's rights and
-- bypasses RLS on the tables it reads, so the inner `sessions` access no longer
-- re-enters sessions_select — the cycle is cut. Behaviour is identical: a coach
-- who is the approved replacement for any session of a class may read that
-- class's enrollments (to render the check-in roster).
-- ============================================================================

-- Does the caller cover (as the approved replacement) any session of this class?
-- security definer → the internal read of public.sessions does NOT trigger
-- sessions' RLS, so enrollments_select stops recursing back into it.
create or replace function public.replacement_covers_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.coach_leave_requests clr
    join public.sessions s on s.id = clr.session_id
    where clr.status = 'approved'
      and clr.replacement_coach_id = auth.uid()
      and s.class_id = p_class_id
  );
$$;

-- Re-create enrollments_select WITHOUT the inline sessions join (same logic,
-- now via the definer helper). This is the only edge that closed the loop.
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select to authenticated
  using (
    public.admin_of_class(class_id)
    or public.coach_of_class(class_id)
    or public.parent_of_student(student_id)
    or public.replacement_covers_class(class_id)
  );
