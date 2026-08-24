-- Shared school calendar overlays (admin add / edit / delete).
-- Seed rows stay in the app; this table stores diffs so teacher accounts see them.

create table if not exists public.campus_calendar_events (
  id text primary key,
  date date not null,
  title text not null default '',
  kind text not null check (
    kind in (
      'holiday',
      'event',
      'timetable',
      'progress',
      'department',
      'assessment',
      'school-day',
      'non-school-day'
    )
  ),
  school_year_start int null,
  created_by text not null default '',
  audience jsonb not null default '{"type":"all"}'::jsonb,
  lesson jsonb null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists campus_calendar_events_date_idx
  on public.campus_calendar_events (date);

create index if not exists campus_calendar_events_deleted_idx
  on public.campus_calendar_events (deleted);

alter table public.campus_calendar_events enable row level security;

drop policy if exists "campus_calendar_events_select_authenticated"
  on public.campus_calendar_events;
drop policy if exists "campus_calendar_events_select_anon"
  on public.campus_calendar_events;
drop policy if exists "campus_calendar_events_write_authenticated"
  on public.campus_calendar_events;
drop policy if exists "campus_calendar_events_write_anon"
  on public.campus_calendar_events;

create policy "campus_calendar_events_select_authenticated"
  on public.campus_calendar_events for select to authenticated using (true);
create policy "campus_calendar_events_select_anon"
  on public.campus_calendar_events for select to anon using (true);

-- Mock staff login has no Auth user yet; anon write matches roster read access.
create policy "campus_calendar_events_write_authenticated"
  on public.campus_calendar_events for all to authenticated
  using (true) with check (true);
create policy "campus_calendar_events_write_anon"
  on public.campus_calendar_events for all to anon
  using (true) with check (true);

grant select, insert, update, delete
  on public.campus_calendar_events to anon, authenticated;

alter table public.campus_calendar_events replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.campus_calendar_events;
exception
  when duplicate_object then null;
end $$;
