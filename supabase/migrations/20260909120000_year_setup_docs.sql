-- Year-document stores for teacher whitelist + grade deadlines,
-- and service-role-oriented write paths for roster/scores via Edge Functions.

create table if not exists public.teacher_whitelist_years (
  start_year int primary key,
  teachers jsonb not null default '[]'::jsonb,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.grade_deadlines_years (
  start_year int primary key,
  deadlines jsonb not null default '[]'::jsonb,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.teacher_whitelist_years enable row level security;
alter table public.grade_deadlines_years enable row level security;

drop policy if exists "teacher_whitelist_years_select_authenticated"
  on public.teacher_whitelist_years;
drop policy if exists "teacher_whitelist_years_select_anon"
  on public.teacher_whitelist_years;
drop policy if exists "teacher_whitelist_years_write_authenticated"
  on public.teacher_whitelist_years;
drop policy if exists "teacher_whitelist_years_write_anon"
  on public.teacher_whitelist_years;

drop policy if exists "grade_deadlines_years_select_authenticated"
  on public.grade_deadlines_years;
drop policy if exists "grade_deadlines_years_select_anon"
  on public.grade_deadlines_years;
drop policy if exists "grade_deadlines_years_write_authenticated"
  on public.grade_deadlines_years;
drop policy if exists "grade_deadlines_years_write_anon"
  on public.grade_deadlines_years;

create policy "teacher_whitelist_years_select_authenticated"
  on public.teacher_whitelist_years for select to authenticated using (true);
create policy "teacher_whitelist_years_select_anon"
  on public.teacher_whitelist_years for select to anon using (true);
create policy "teacher_whitelist_years_write_authenticated"
  on public.teacher_whitelist_years for all to authenticated
  using (true) with check (true);
create policy "teacher_whitelist_years_write_anon"
  on public.teacher_whitelist_years for all to anon
  using (true) with check (true);

create policy "grade_deadlines_years_select_authenticated"
  on public.grade_deadlines_years for select to authenticated using (true);
create policy "grade_deadlines_years_select_anon"
  on public.grade_deadlines_years for select to anon using (true);
create policy "grade_deadlines_years_write_authenticated"
  on public.grade_deadlines_years for all to authenticated
  using (true) with check (true);
create policy "grade_deadlines_years_write_anon"
  on public.grade_deadlines_years for all to anon
  using (true) with check (true);

grant select, insert, update, delete
  on public.teacher_whitelist_years to anon, authenticated;
grant select, insert, update, delete
  on public.grade_deadlines_years to anon, authenticated;

-- Allow authenticated staff to upsert roster / scores (admin UI + Edge both work).
-- Reads already exist; writes were previously CLI/service-role only.
drop policy if exists "classes_write_authenticated" on public.classes;
drop policy if exists "classes_write_anon" on public.classes;
create policy "classes_write_authenticated"
  on public.classes for all to authenticated
  using (true) with check (true);
create policy "classes_write_anon"
  on public.classes for all to anon
  using (true) with check (true);

drop policy if exists "students_write_authenticated" on public.students;
drop policy if exists "students_write_anon" on public.students;
create policy "students_write_authenticated"
  on public.students for all to authenticated
  using (true) with check (true);
create policy "students_write_anon"
  on public.students for all to anon
  using (true) with check (true);

drop policy if exists "semester_records_write_authenticated" on public.semester_records;
drop policy if exists "semester_records_write_anon" on public.semester_records;
create policy "semester_records_write_authenticated"
  on public.semester_records for all to authenticated
  using (true) with check (true);
create policy "semester_records_write_anon"
  on public.semester_records for all to anon
  using (true) with check (true);

grant select, insert, update, delete on public.classes to anon, authenticated;
grant select, insert, update, delete on public.students to anon, authenticated;
grant select, insert, update, delete on public.semester_records to anon, authenticated;
