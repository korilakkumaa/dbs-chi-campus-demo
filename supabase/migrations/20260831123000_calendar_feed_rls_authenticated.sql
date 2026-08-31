-- Google OAuth users get role `authenticated`, not `anon`.
-- Without these policies, feed token + Google sync writes fail after Google sign-in.

drop policy if exists "calendar_feed_tokens_select_authenticated"
  on public.calendar_feed_tokens;
drop policy if exists "calendar_feed_tokens_write_authenticated"
  on public.calendar_feed_tokens;

create policy "calendar_feed_tokens_select_authenticated"
  on public.calendar_feed_tokens for select to authenticated using (true);
create policy "calendar_feed_tokens_write_authenticated"
  on public.calendar_feed_tokens for all to authenticated
  using (true) with check (true);

drop policy if exists "google_calendar_sync_authenticated"
  on public.google_calendar_sync;
drop policy if exists "google_calendar_event_map_authenticated"
  on public.google_calendar_event_map;

create policy "google_calendar_sync_authenticated"
  on public.google_calendar_sync for all to authenticated
  using (true) with check (true);
create policy "google_calendar_event_map_authenticated"
  on public.google_calendar_event_map for all to authenticated
  using (true) with check (true);
