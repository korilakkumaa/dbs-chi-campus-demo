-- 2025/26 Chinese scores: classes, students, semester records, staff profiles
-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.classes (
  id text primary key,
  name text not null unique,
  grade int not null check (grade between 7 and 12),
  teacher_id uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'teacher', 'student')),
  created_at timestamptz not null default now()
);

create table if not exists public.class_teachers (
  class_id text not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  primary key (class_id, teacher_id)
);

create table if not exists public.students (
  student_no text primary key,
  class_id text not null references public.classes (id),
  class_number int not null,
  name_zh text not null,
  name_en text not null default '',
  teaching_group text not null default '',
  academic_year_start int not null default 2025,
  updated_at timestamptz not null default now()
);

create index if not exists students_class_id_idx on public.students (class_id);
create index if not exists students_year_idx on public.students (academic_year_start);

create table if not exists public.semester_records (
  id uuid primary key default gen_random_uuid(),
  student_no text not null references public.students (student_no) on delete cascade,
  academic_year_start int not null,
  grade int not null check (grade between 7 and 12),
  semester text not null check (semester in ('first', 'second')),
  daily numeric(6, 2) not null default 0,
  reading numeric(6, 2) not null default 0,
  writing numeric(6, 2) not null default 0,
  components jsonb not null default '{}'::jsonb,
  attitude_grade text not null default '',
  remarks text not null default '',
  source_file text not null default '',
  updated_at timestamptz not null default now(),
  unique (student_no, academic_year_start, semester)
);

create index if not exists semester_records_student_idx
  on public.semester_records (student_no);
create index if not exists semester_records_year_idx
  on public.semester_records (academic_year_start, grade, semester);

-- ---------------------------------------------------------------------------
-- RLS
-- Staff CMS: authenticated staff can read. Anon read enabled so the current
-- mock login can still load roster until Supabase Auth accounts are seeded.
-- Tighten by dropping anon policies after Auth migration.
-- ---------------------------------------------------------------------------

alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.class_teachers enable row level security;
alter table public.students enable row level security;
alter table public.semester_records enable row level security;

drop policy if exists "classes_select_authenticated" on public.classes;
drop policy if exists "classes_select_anon" on public.classes;
create policy "classes_select_authenticated"
  on public.classes for select to authenticated using (true);
create policy "classes_select_anon"
  on public.classes for select to anon using (true);

drop policy if exists "students_select_authenticated" on public.students;
drop policy if exists "students_select_anon" on public.students;
create policy "students_select_authenticated"
  on public.students for select to authenticated using (true);
create policy "students_select_anon"
  on public.students for select to anon using (true);

drop policy if exists "semester_records_select_authenticated" on public.semester_records;
drop policy if exists "semester_records_select_anon" on public.semester_records;
create policy "semester_records_select_authenticated"
  on public.semester_records for select to authenticated using (true);
create policy "semester_records_select_anon"
  on public.semester_records for select to anon using (true);

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "class_teachers_select_authenticated" on public.class_teachers;
drop policy if exists "class_teachers_select_anon" on public.class_teachers;
create policy "class_teachers_select_authenticated"
  on public.class_teachers for select to authenticated using (true);
create policy "class_teachers_select_anon"
  on public.class_teachers for select to anon using (true);
