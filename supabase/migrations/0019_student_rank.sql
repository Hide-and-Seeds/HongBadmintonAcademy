-- Per-student rank, assigned by coaches (after assessments) and promotable by
-- admin. Overrides the class-derived rank for display; when null the student
-- still shows their class's rank (see src/lib/ranks.ts -> studentRank()).
alter table public.students add column if not exists rank text;
