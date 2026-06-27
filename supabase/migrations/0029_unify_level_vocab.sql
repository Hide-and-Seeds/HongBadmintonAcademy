-- Option C: the app now speaks ONE tier vocabulary — the 6 training-level names
-- (Starter / Beginner / Intermediate / Advanced / Competition Team / Elite Team).
-- The legacy 4-tier labels on classes + fee plans were Beginner/Intermediate/
-- Advanced/Elite; the first three are already valid level names, so only the
-- old "Elite" needs renaming to "Elite Team" to keep colouring + the tier
-- dropdowns consistent.
--
-- `students.rank` (the old per-student coarse tier) is now DEPRECATED — the
-- student's standing lives in `students.level` (1–6). We intentionally do NOT
-- drop the column (irreversible); it is simply no longer read or written.

update public.classes   set level = 'Elite Team' where level = 'Elite';
update public.fee_plans set rank  = 'Elite Team' where rank  = 'Elite';
