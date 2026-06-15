-- Small key/value store for app-level toggles. First use: a worker kill switch
-- so the admin can pause/resume the WhatsApp drip worker from the UI without
-- touching the VM (the worker endpoint reads this flag and simply idles).

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Admins manage settings from the UI; the service-role key (worker/cron) bypasses
-- RLS for its reads.
drop policy if exists app_settings_admin_all on public.app_settings;
create policy app_settings_admin_all on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());
