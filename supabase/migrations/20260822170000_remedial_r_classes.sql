-- Chinese remedial streams (補底班) for junior grades — not on the admin form-class roll.
insert into public.classes (id, name, grade) values
  ('c-7r', '7R', 7),
  ('c-8r', '8R', 8),
  ('c-9r', '9R', 9)
on conflict (id) do update set name = excluded.name, grade = excluded.grade;
