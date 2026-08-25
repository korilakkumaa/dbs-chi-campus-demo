-- Homework ABS reminders: synced Sheet rows, permanent dismissals, email logs.

create table if not exists public.homework_abs_items (
  id text primary key,
  academic_year_start int not null,
  class_label text not null default '',
  group_label text not null default '',
  teacher_initial text not null default '',
  assignment_name text not null,
  student_no text not null default '',
  class_number int null,
  student_name text not null default '',
  abs_raw text not null default '',
  sheet_row int null,
  active boolean not null default true,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists homework_abs_items_year_active_idx
  on public.homework_abs_items (academic_year_start, active);
create index if not exists homework_abs_items_group_idx
  on public.homework_abs_items (group_label);
create index if not exists homework_abs_items_student_idx
  on public.homework_abs_items (student_no);

create table if not exists public.homework_abs_dismissals (
  id text primary key,
  abs_item_id text not null references public.homework_abs_items (id) on delete cascade,
  academic_year_start int not null,
  student_no text not null default '',
  assignment_name text not null,
  dismissed_by text not null default '',
  dismissed_at timestamptz not null default now()
);

create unique index if not exists homework_abs_dismissals_item_uidx
  on public.homework_abs_dismissals (abs_item_id);

create table if not exists public.homework_abs_email_logs (
  id text primary key,
  abs_item_id text not null references public.homework_abs_items (id) on delete cascade,
  academic_year_start int not null,
  student_no text not null default '',
  student_name text not null default '',
  class_label text not null default '',
  group_label text not null default '',
  assignment_name text not null,
  to_email text not null,
  teacher_id text not null default '',
  teacher_initial text not null default '',
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed')),
  error_message text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz null
);

create index if not exists homework_abs_email_logs_teacher_idx
  on public.homework_abs_email_logs (teacher_id, created_at desc);
create index if not exists homework_abs_email_logs_status_idx
  on public.homework_abs_email_logs (status);

alter table public.homework_abs_items enable row level security;
alter table public.homework_abs_dismissals enable row level security;
alter table public.homework_abs_email_logs enable row level security;

drop policy if exists "homework_abs_items_select_authenticated"
  on public.homework_abs_items;
drop policy if exists "homework_abs_items_select_anon"
  on public.homework_abs_items;
drop policy if exists "homework_abs_items_write_authenticated"
  on public.homework_abs_items;
drop policy if exists "homework_abs_items_write_anon"
  on public.homework_abs_items;

create policy "homework_abs_items_select_authenticated"
  on public.homework_abs_items for select to authenticated using (true);
create policy "homework_abs_items_select_anon"
  on public.homework_abs_items for select to anon using (true);
create policy "homework_abs_items_write_authenticated"
  on public.homework_abs_items for all to authenticated
  using (true) with check (true);
create policy "homework_abs_items_write_anon"
  on public.homework_abs_items for all to anon
  using (true) with check (true);

drop policy if exists "homework_abs_dismissals_select_authenticated"
  on public.homework_abs_dismissals;
drop policy if exists "homework_abs_dismissals_select_anon"
  on public.homework_abs_dismissals;
drop policy if exists "homework_abs_dismissals_write_authenticated"
  on public.homework_abs_dismissals;
drop policy if exists "homework_abs_dismissals_write_anon"
  on public.homework_abs_dismissals;

create policy "homework_abs_dismissals_select_authenticated"
  on public.homework_abs_dismissals for select to authenticated using (true);
create policy "homework_abs_dismissals_select_anon"
  on public.homework_abs_dismissals for select to anon using (true);
create policy "homework_abs_dismissals_write_authenticated"
  on public.homework_abs_dismissals for all to authenticated
  using (true) with check (true);
create policy "homework_abs_dismissals_write_anon"
  on public.homework_abs_dismissals for all to anon
  using (true) with check (true);

drop policy if exists "homework_abs_email_logs_select_authenticated"
  on public.homework_abs_email_logs;
drop policy if exists "homework_abs_email_logs_select_anon"
  on public.homework_abs_email_logs;
drop policy if exists "homework_abs_email_logs_write_authenticated"
  on public.homework_abs_email_logs;
drop policy if exists "homework_abs_email_logs_write_anon"
  on public.homework_abs_email_logs;

create policy "homework_abs_email_logs_select_authenticated"
  on public.homework_abs_email_logs for select to authenticated using (true);
create policy "homework_abs_email_logs_select_anon"
  on public.homework_abs_email_logs for select to anon using (true);
create policy "homework_abs_email_logs_write_authenticated"
  on public.homework_abs_email_logs for all to authenticated
  using (true) with check (true);
create policy "homework_abs_email_logs_write_anon"
  on public.homework_abs_email_logs for all to anon
  using (true) with check (true);

grant select, insert, update, delete
  on public.homework_abs_items to anon, authenticated;
grant select, insert, update, delete
  on public.homework_abs_dismissals to anon, authenticated;
grant select, insert, update, delete
  on public.homework_abs_email_logs to anon, authenticated;
