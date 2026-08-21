-- Add master-roster fields (2025/26 Student Name List)
-- Run in Supabase SQL Editor after the base campus_scores migration.

alter table public.students
  add column if not exists house text not null default '',
  add column if not exists french boolean not null default false,
  add column if not exists roster_remarks text not null default '';
