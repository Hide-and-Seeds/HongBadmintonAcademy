-- Branch colour tag. A small fixed palette (token keys, not hex) so the UI can
-- map each to Tailwind classes and colour-code branches everywhere they appear
-- (chips in student/coach/staff/session lists, the branch switcher, etc.).
alter table branches add column if not exists color text;

-- Give existing branches distinct colours by creation order so they're
-- immediately distinguishable. New branches default to 'slate' until picked.
with ordered as (
  select id, row_number() over (order by created_at, id) as rn from branches
)
update branches b
set color = (array['emerald','blue','amber','rose','violet','cyan','orange','teal'])[((o.rn - 1) % 8) + 1]
from ordered o
where o.id = b.id and (b.color is null or b.color = '');
