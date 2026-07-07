-- Public self-signup (2b) creates a member in 'pending' state; the Stripe
-- webhook flips them to 'active' once the first dues payment clears. Widen the
-- status check to allow 'pending'.

alter table public.club_members drop constraint if exists club_members_status_chk;
alter table public.club_members add constraint club_members_status_chk
  check (status in ('pending','active','inactive'));
