-- ============================================================================
-- 0011_growth_report.sql
-- Reposition the score card as a character "Monthly Growth Report". The coach
-- monthly assessment now scores 11 dimensions in 3 groups (Physical, Technical,
-- Character); the Character group drives the HBA Growth Index. Adds a category
-- to marking_criteria and seeds the new active scheme, retiring the old skills
-- one.
-- ============================================================================

alter table public.marking_criteria
  add column if not exists category text
  check (category is null or category in ('physical', 'technical', 'character'));

-- Retire the old skills-only scheme.
update public.marking_schemes set is_active = false where name = 'Junior Skills v1';

-- New active scheme + its grouped dimensions (0–100 each, equal weight).
with sch as (
  insert into public.marking_schemes (name, description, is_active)
  values ('HBA Growth Report', 'Physical, technical & character development', true)
  returning id
)
insert into public.marking_criteria (scheme_id, name, weight, max_score, sort_order, category)
select sch.id, d.name, 1, 100, d.ord, d.cat
from sch, (values
  ('Fitness',     1, 'physical'),
  ('Agility',     2, 'physical'),
  ('Endurance',   3, 'physical'),
  ('Footwork',    4, 'technical'),
  ('Serve',       5, 'technical'),
  ('Match play',  6, 'technical'),
  ('Discipline',  7, 'character'),
  ('Confidence',  8, 'character'),
  ('Resilience',  9, 'character'),
  ('Teamwork',   10, 'character'),
  ('Leadership', 11, 'character')
) as d(name, ord, cat);
