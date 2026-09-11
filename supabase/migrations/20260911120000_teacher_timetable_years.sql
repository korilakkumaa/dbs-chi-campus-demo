-- Year-document store for teacher weekly timetables (個人／班級時間表).
-- Static generated TS seeds stay in the app; this table holds admin-edited payloads.
-- Class timetables are derived from these personal weekly grids.

create table if not exists public.teacher_timetable_years (
  start_year int primary key,
  timetables jsonb not null default '{}'::jsonb,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.teacher_timetable_years enable row level security;

drop policy if exists "teacher_timetable_years_select_authenticated"
  on public.teacher_timetable_years;
drop policy if exists "teacher_timetable_years_select_anon"
  on public.teacher_timetable_years;
drop policy if exists "teacher_timetable_years_write_authenticated"
  on public.teacher_timetable_years;
drop policy if exists "teacher_timetable_years_write_anon"
  on public.teacher_timetable_years;

create policy "teacher_timetable_years_select_authenticated"
  on public.teacher_timetable_years for select to authenticated using (true);
create policy "teacher_timetable_years_select_anon"
  on public.teacher_timetable_years for select to anon using (true);
create policy "teacher_timetable_years_write_authenticated"
  on public.teacher_timetable_years for all to authenticated
  using (true) with check (true);
create policy "teacher_timetable_years_write_anon"
  on public.teacher_timetable_years for all to anon
  using (true) with check (true);

grant select, insert, update, delete
  on public.teacher_timetable_years to anon, authenticated;
