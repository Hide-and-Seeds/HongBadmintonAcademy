-- ============================================================================
-- 0025_growth_report_simple.sql
-- Boss feedback: the monthly assessment had too much to mark (11 dimensions
-- across Physical/Technical/Character). Collapse to ONE quick rating per group
-- plus the coach's observation note.
--
-- Safe because the report generator + parent/admin views are criteria-count
-- agnostic: scorecards.ts groups assessment_scores by category and normalizes
-- score/max*100, resolving each criterion's group by id OR name. So:
--   * old (11-dimension) assessments keep rendering exactly as before, and
--   * the HBA Growth Index (Character average) still works with a single
--     character dimension.
--
-- We retire the detailed scheme (leaving its criteria rows in place for the
-- historical assessments that reference them) and seed a 3-criterion one,
-- rated 1-5, equal weight. Idempotent so it is safe to re-run.
-- ============================================================================

-- 1. Retire the 11-dimension scheme.
update public.marking_schemes set is_active = false where name = 'HBA Growth Report';

-- 2. Create the 3-criterion scheme once.
insert into public.marking_schemes (name, description, is_active)
select 'HBA Growth Report v2', 'One quick rating per area: physical, technical & character', true
where not exists (select 1 from public.marking_schemes where name = 'HBA Growth Report v2');

-- 3. Seed its 3 criteria once (one per development group, 1-5, equal weight).
insert into public.marking_criteria (scheme_id, name, weight, max_score, sort_order, category)
select s.id, d.name, 1, 5, d.ord, d.cat
from public.marking_schemes s
cross join (values
  ('Fitness & footwork',   1, 'physical'),
  ('Skills & match play',  2, 'technical'),
  ('Attitude & character', 3, 'character')
) as d(name, ord, cat)
where s.name = 'HBA Growth Report v2'
  and not exists (select 1 from public.marking_criteria c where c.scheme_id = s.id);

-- 4. Ensure v2 is the active scheme (covers a re-run after step 1).
update public.marking_schemes set is_active = true where name = 'HBA Growth Report v2';
