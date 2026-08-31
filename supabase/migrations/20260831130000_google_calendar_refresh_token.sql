-- Persist Google refresh token for calendar sync (optional; set after OAuth consent).

alter table public.google_calendar_sync
  add column if not exists provider_refresh_token text null;
