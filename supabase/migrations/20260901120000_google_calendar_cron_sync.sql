-- Backend cron sync metadata for Google Calendar.

alter table public.google_calendar_sync
  add column if not exists last_synced_at timestamptz null,
  add column if not exists last_sync_error text null;
