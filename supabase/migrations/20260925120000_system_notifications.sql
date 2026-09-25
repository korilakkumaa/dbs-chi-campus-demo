-- In-app system notifications (e.g. new calendar events for teachers).

create table if not exists public.system_notifications (
  id text primary key,
  recipient_id text not null,
  type text not null default 'calendar_event'
    check (type in ('calendar_event')),
  title text not null,
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_by text not null default '',
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists system_notifications_recipient_created_idx
  on public.system_notifications (recipient_id, created_at desc);

create index if not exists system_notifications_recipient_unread_idx
  on public.system_notifications (recipient_id)
  where read_at is null;

alter table public.system_notifications enable row level security;

drop policy if exists "system_notifications_select_authenticated"
  on public.system_notifications;
drop policy if exists "system_notifications_select_anon"
  on public.system_notifications;
drop policy if exists "system_notifications_write_authenticated"
  on public.system_notifications;
drop policy if exists "system_notifications_write_anon"
  on public.system_notifications;

-- Portal uses anon key for staff sessions; mirror other campus tables.
create policy "system_notifications_select_authenticated"
  on public.system_notifications for select to authenticated using (true);
create policy "system_notifications_select_anon"
  on public.system_notifications for select to anon using (true);

create policy "system_notifications_write_authenticated"
  on public.system_notifications for all to authenticated
  using (true) with check (true);
create policy "system_notifications_write_anon"
  on public.system_notifications for all to anon
  using (true) with check (true);

grant select, insert, update, delete
  on public.system_notifications to anon, authenticated;

alter table public.system_notifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.system_notifications;
exception
  when duplicate_object then null;
end $$;
