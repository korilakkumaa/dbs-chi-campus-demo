-- Year-document stores for assessment duty (出卷) and dept duty (職責).
-- Static TS seeds stay in the app; these tables hold admin-edited year payloads.

create table if not exists public.assessment_duty_years (
  start_year int primary key,
  label text not null default '',
  title text not null default '',
  category_labels jsonb not null default '{}'::jsonb,
  category_short_labels jsonb not null default '{}'::jsonb,
  grade_matrix jsonb not null default '[]'::jsonb,
  ec_appendix jsonb not null default '[]'::jsonb,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.dept_duty_years (
  start_year int primary key,
  label text not null default '',
  source text not null default '',
  items jsonb not null default '[]'::jsonb,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.assessment_duty_years enable row level security;
alter table public.dept_duty_years enable row level security;

drop policy if exists "assessment_duty_years_select_authenticated"
  on public.assessment_duty_years;
drop policy if exists "assessment_duty_years_select_anon"
  on public.assessment_duty_years;
drop policy if exists "assessment_duty_years_write_authenticated"
  on public.assessment_duty_years;
drop policy if exists "assessment_duty_years_write_anon"
  on public.assessment_duty_years;

drop policy if exists "dept_duty_years_select_authenticated"
  on public.dept_duty_years;
drop policy if exists "dept_duty_years_select_anon"
  on public.dept_duty_years;
drop policy if exists "dept_duty_years_write_authenticated"
  on public.dept_duty_years;
drop policy if exists "dept_duty_years_write_anon"
  on public.dept_duty_years;

create policy "assessment_duty_years_select_authenticated"
  on public.assessment_duty_years for select to authenticated using (true);
create policy "assessment_duty_years_select_anon"
  on public.assessment_duty_years for select to anon using (true);
create policy "assessment_duty_years_write_authenticated"
  on public.assessment_duty_years for all to authenticated
  using (true) with check (true);
create policy "assessment_duty_years_write_anon"
  on public.assessment_duty_years for all to anon
  using (true) with check (true);

create policy "dept_duty_years_select_authenticated"
  on public.dept_duty_years for select to authenticated using (true);
create policy "dept_duty_years_select_anon"
  on public.dept_duty_years for select to anon using (true);
create policy "dept_duty_years_write_authenticated"
  on public.dept_duty_years for all to authenticated
  using (true) with check (true);
create policy "dept_duty_years_write_anon"
  on public.dept_duty_years for all to anon
  using (true) with check (true);

grant select, insert, update, delete
  on public.assessment_duty_years to anon, authenticated;
grant select, insert, update, delete
  on public.dept_duty_years to anon, authenticated;
