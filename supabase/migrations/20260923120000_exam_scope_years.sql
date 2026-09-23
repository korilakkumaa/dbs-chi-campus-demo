-- Year-document store for exam/test scope (測考範圍).
-- Admin CSV import / upsert; teachers read the shared year payload.

create table if not exists public.exam_scope_years (
  start_year int primary key,
  label text not null default '',
  source text not null default '',
  rows jsonb not null default '[]'::jsonb,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.exam_scope_years enable row level security;

drop policy if exists "exam_scope_years_select_authenticated"
  on public.exam_scope_years;
drop policy if exists "exam_scope_years_select_anon"
  on public.exam_scope_years;
drop policy if exists "exam_scope_years_write_authenticated"
  on public.exam_scope_years;
drop policy if exists "exam_scope_years_write_anon"
  on public.exam_scope_years;

create policy "exam_scope_years_select_authenticated"
  on public.exam_scope_years for select to authenticated using (true);
create policy "exam_scope_years_select_anon"
  on public.exam_scope_years for select to anon using (true);
create policy "exam_scope_years_write_authenticated"
  on public.exam_scope_years for all to authenticated
  using (true) with check (true);
create policy "exam_scope_years_write_anon"
  on public.exam_scope_years for all to anon
  using (true) with check (true);

grant select, insert, update, delete
  on public.exam_scope_years to anon, authenticated;
