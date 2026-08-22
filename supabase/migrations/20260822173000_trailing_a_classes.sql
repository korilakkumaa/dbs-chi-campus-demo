-- Chinese A streams after T (10A in 2025/26; 11A from 2026/27).
insert into public.classes (id, name, grade) values
  ('c-10a', '10A', 10),
  ('c-11a', '11A', 11)
on conflict (id) do update set name = excluded.name, grade = excluded.grade;
