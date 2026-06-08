-- Module 4/3: throttled auto-reminder queue.
-- Pending WhatsApp reminders are parked here and drip-sent by the always-on
-- worker under a very-cautious policy (daytime window, daily cap, min-gap,
-- random skips). On a successful send a row is also written to public.messages
-- (the WhatsApp Log), keeping the existing log behaviour.

create table if not exists public.message_queue (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null,                       -- 'before_due' | 'due_day'
  invoice_id           uuid references public.invoices(id) on delete cascade,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  recipient_phone      text not null,
  body                 text not null,
  status               text not null default 'queued',      -- queued|sending|sent|failed|canceled
  attempts             int  not null default 0,
  provider_message_id  text,
  error                text,
  created_at           timestamptz not null default now(),
  sent_at              timestamptz
);

-- One nudge per invoice per stage (dedupes repeated daily cron runs).
create unique index if not exists uq_message_queue_invoice_kind
  on public.message_queue(invoice_id, kind);
create index if not exists idx_message_queue_status on public.message_queue(status);

-- Server-only table: enable RLS with no policies so anon/authenticated have no
-- access; the service-role key (cron + worker endpoints) bypasses RLS.
alter table public.message_queue enable row level security;
