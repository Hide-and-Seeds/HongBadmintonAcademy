-- Tag court rental COSTS by arm so the club's own court expense (courts it rents
-- for member play) lands in the club pot, not the academy's. Default 'academy'
-- keeps every existing rental where it was.

alter table public.court_rentals add column if not exists business text not null default 'academy';
alter table public.court_rentals drop constraint if exists court_rentals_business_chk;
alter table public.court_rentals add constraint court_rentals_business_chk check (business in ('academy','club'));
