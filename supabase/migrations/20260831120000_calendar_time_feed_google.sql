-- Optional event time + personal calendar feed tokens + Google Calendar sync maps.

alter table public.campus_calendar_events
  add column if not exists event_time jsonb null;

create table if not exists public.calendar_feed_tokens (
  user_id text primary key,
  token text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists calendar_feed_tokens_token_idx
  on public.calendar_feed_tokens (token);

alter table public.calendar_feed_tokens enable row level security;

drop policy if exists "calendar_feed_tokens_select_anon"
  on public.calendar_feed_tokens;
drop policy if exists "calendar_feed_tokens_write_anon"
  on public.calendar_feed_tokens;

create policy "calendar_feed_tokens_select_anon"
  on public.calendar_feed_tokens for select to anon using (true);
create policy "calendar_feed_tokens_write_anon"
  on public.calendar_feed_tokens for all to anon
  using (true) with check (true);

grant select, insert, update, delete
  on public.calendar_feed_tokens to anon, authenticated;

-- Google OAuth sessions use role `authenticated`; anon-only policies block feed tokens.
drop policy if exists "calendar_feed_tokens_select_authenticated"
  on public.calendar_feed_tokens;
drop policy if exists "calendar_feed_tokens_write_authenticated"
  on public.calendar_feed_tokens;

create policy "calendar_feed_tokens_select_authenticated"
  on public.calendar_feed_tokens for select to authenticated using (true);
create policy "calendar_feed_tokens_write_authenticated"
  on public.calendar_feed_tokens for all to authenticated
  using (true) with check (true);

create table if not exists public.google_calendar_sync (
  user_id text primary key,
  enabled boolean not null default true,
  calendar_id text not null default 'primary',
  updated_at timestamptz not null default now()
);

create table if not exists public.google_calendar_event_map (
  user_id text not null,
  campus_event_id text not null,
  google_event_id text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, campus_event_id)
);

create index if not exists google_calendar_event_map_user_idx
  on public.google_calendar_event_map (user_id);

alter table public.google_calendar_sync enable row level security;
alter table public.google_calendar_event_map enable row level security;

drop policy if exists "google_calendar_sync_anon"
  on public.google_calendar_sync;
drop policy if exists "google_calendar_event_map_anon"
  on public.google_calendar_event_map;

create policy "google_calendar_sync_anon"
  on public.google_calendar_sync for all to anon
  using (true) with check (true);
create policy "google_calendar_sync_authenticated"
  on public.google_calendar_sync for all to authenticated
  using (true) with check (true);
create policy "google_calendar_event_map_anon"
  on public.google_calendar_event_map for all to anon
  using (true) with check (true);
create policy "google_calendar_event_map_authenticated"
  on public.google_calendar_event_map for all to authenticated
  using (true) with check (true);

grant select, insert, update, delete
  on public.google_calendar_sync,
  public.google_calendar_event_map
  to anon, authenticated;
