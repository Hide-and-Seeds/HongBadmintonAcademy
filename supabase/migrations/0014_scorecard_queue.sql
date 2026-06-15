-- Auto-send Monthly Growth Reports through the SAME drip queue as fee reminders.
-- Scorecards are enqueued (kind='scorecard') after generation and drip-sent by
-- the always-on worker under the existing anti-ban policy. On a successful send
-- the worker writes the WhatsApp Log row and flips the scorecard to 'sent'.

alter table public.message_queue
  add column if not exists scorecard_id uuid references public.scorecards(id) on delete cascade;

-- One send per scorecard per kind (dedupes repeated cron runs). Partial so it
-- never collides with invoice reminder rows (scorecard_id is null there).
create unique index if not exists uq_message_queue_scorecard_kind
  on public.message_queue(scorecard_id, kind)
  where scorecard_id is not null;
