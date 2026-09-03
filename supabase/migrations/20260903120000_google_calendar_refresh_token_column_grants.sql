-- Keep Google refresh tokens readable only by the service role.
-- Frontend never SELECTs provider_refresh_token; cron uses service role.

revoke all on table public.google_calendar_sync from anon, authenticated;

grant select (
  user_id,
  enabled,
  calendar_id,
  updated_at,
  last_synced_at,
  last_sync_error
) on table public.google_calendar_sync to anon, authenticated;

grant insert, update, delete
  on table public.google_calendar_sync to anon, authenticated;
