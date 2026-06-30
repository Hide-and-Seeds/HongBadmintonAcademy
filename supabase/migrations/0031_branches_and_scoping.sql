-- ============================================================================
-- 0031_branches_and_scoping.sql
-- Multi-branch model + access scoping + super-admin tier helpers.
-- branch-admin = a plain 'admin' bound to one branch (RLS-isolated to it).
-- super_admin  = cross-branch, owns staff/branches/settings/refunds.
-- ============================================================================

-- ─── branches ───────────────────────────────────────────────────────────────
create table if not exists public.branches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text unique,
  address    text,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.branches;
create trigger set_updated_at before update on public.branches
  for each row execute function moddatetime(updated_at);

insert into public.branches (name, code)
select 'Main', 'MAIN'
where not exists (select 1 from public.branches);

-- ─── branch_id on owned tables ──────────────────────────────────────────────
alter table public.profiles add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.students add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.classes  add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.sessions add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.invoices add column if not exists branch_id uuid references public.branches(id) on delete set null;

create index if not exists idx_students_branch on public.students(branch_id);
create index if not exists idx_classes_branch  on public.classes(branch_id);
create index if not exists idx_sessions_branch on public.sessions(branch_id);
create index if not exists idx_invoices_branch on public.invoices(branch_id);
create index if not exists idx_profiles_branch on public.profiles(branch_id);

-- Backfill every existing row to the default branch (sessions inherit class,
-- invoices inherit student), and promote the seed admin to super_admin.
do $$
declare b uuid;
begin
  select id into b from public.branches order by created_at limit 1;
  update public.students set branch_id = b where branch_id is null;
  update public.classes  set branch_id = b where branch_id is null;
  update public.sessions se set branch_id = c.branch_id from public.classes c
    where se.class_id = c.id and se.branch_id is null;
  update public.sessions set branch_id = b where branch_id is null;
  update public.invoices iv set branch_id = s.branch_id from public.students s
    where iv.student_id = s.id and iv.branch_id is null;
  update public.invoices set branch_id = b where branch_id is null;
  update public.profiles set branch_id = b where branch_id is null and role in ('admin','coach','super_admin');
end $$;

update public.profiles set role = 'super_admin'
where id = '00000000-0000-0000-0000-000000000001' and role = 'admin';

-- ─── RBAC helpers: super-admin + branch gate ────────────────────────────────
-- is_admin() now also matches super_admin so every existing admin policy keeps
-- working and super-admin inherits full admin rights.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','super_admin') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

-- Admin gate for a branch-scoped row: super-admin → any branch; branch-admin →
-- only their own branch. NULL-branch rows stay visible to all admins.
create or replace function public.admin_branch_ok(p_branch uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
      or (public.is_admin()
          and (p_branch is null
               or p_branch = (select branch_id from public.profiles where id = auth.uid())));
$$;

-- ─── branches RLS (admins read, super-admin writes) ─────────────────────────
alter table public.branches enable row level security;
drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches for select to authenticated
  using (public.is_admin());
drop policy if exists branches_write on public.branches;
create policy branches_write on public.branches for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ─── re-scope owned tables by branch (admin portion only) ───────────────────
-- profiles: staff lifecycle (insert/delete) is super-admin only.
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_super_admin());

-- students
drop policy if exists students_select on public.students;
create policy students_select on public.students for select to authenticated
  using (public.admin_branch_ok(branch_id) or public.parent_of_student(id) or public.coach_of_student(id));
drop policy if exists students_write on public.students;
create policy students_write on public.students for all to authenticated
  using (public.admin_branch_ok(branch_id)) with check (public.admin_branch_ok(branch_id));

-- classes
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select to authenticated
  using (
    public.admin_branch_ok(branch_id)
    or public.coach_of_class(id)
    or exists (select 1 from public.enrollments e join public.students s on s.id = e.student_id
               where e.class_id = classes.id and s.parent_id = auth.uid())
  );
drop policy if exists classes_write on public.classes;
create policy classes_write on public.classes for all to authenticated
  using (public.admin_branch_ok(branch_id)) with check (public.admin_branch_ok(branch_id));

-- sessions
drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions for select to authenticated
  using (
    public.admin_branch_ok(branch_id)
    or public.coach_of_class(class_id)
    or exists (select 1 from public.enrollments e join public.students s on s.id = e.student_id
               where e.class_id = sessions.class_id and s.parent_id = auth.uid())
  );
drop policy if exists sessions_write on public.sessions;
create policy sessions_write on public.sessions for all to authenticated
  using (public.admin_branch_ok(branch_id) or public.coach_of_class(class_id))
  with check (public.admin_branch_ok(branch_id) or public.coach_of_class(class_id));

-- invoices
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select to authenticated
  using (public.admin_branch_ok(branch_id) or parent_id = auth.uid());
drop policy if exists invoices_write on public.invoices;
create policy invoices_write on public.invoices for all to authenticated
  using (public.admin_branch_ok(branch_id)) with check (public.admin_branch_ok(branch_id));

-- payments scope via their invoice's branch
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id
           and (public.admin_branch_ok(i.branch_id) or i.parent_id = auth.uid())));
drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for all to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and public.admin_branch_ok(i.branch_id)))
  with check (exists (select 1 from public.invoices i where i.id = invoice_id and public.admin_branch_ok(i.branch_id)));
