-- Link imported yazokulu.xlsx teachers to Supabase Auth users.
--
-- How to use:
-- 1. In Supabase, go to Authentication > Users.
-- 2. Create one Auth user for each teacher: HEBA, RESUL, SAEIDE.
-- 3. Copy each Auth user's UUID.
-- 4. Replace the all-zero UUID placeholders below.
-- 5. Run this SQL in Supabase SQL Editor.
--
-- This creates/updates public.users rows with role = 'teacher'
-- and links public.teachers.user_id to the matching Auth user.

begin;

create temp table tmp_teacher_auth_links (
  employee_code text primary key,
  auth_user_id uuid not null,
  email text not null,
  full_name text not null
) on commit drop;

insert into tmp_teacher_auth_links (employee_code, auth_user_id, email, full_name)
values
  ('YAZ-HEBA', '00000000-0000-0000-0000-000000000001', 'heba@example.com', 'HEBA'),
  ('YAZ-RESUL', '00000000-0000-0000-0000-000000000002', 'resul@example.com', 'RESUL'),
  ('YAZ-SAEIDE', '00000000-0000-0000-0000-000000000003', 'saeide@example.com', 'SAEIDE');

do $$
begin
  if exists (
    select 1
    from tmp_teacher_auth_links
    where auth_user_id::text like '00000000-0000-0000-0000-00000000000%'
  ) then
    raise exception 'Replace all placeholder auth_user_id values with real Supabase Auth user UUIDs before running.';
  end if;

  if exists (
    select 1
    from tmp_teacher_auth_links l
    where not exists (select 1 from auth.users au where au.id = l.auth_user_id)
  ) then
    raise exception 'At least one auth_user_id does not exist in auth.users. Create the teacher Auth users first.';
  end if;

  if exists (
    select 1
    from tmp_teacher_auth_links l
    where not exists (select 1 from public.teachers t where t.employee_code = l.employee_code)
  ) then
    raise exception 'At least one imported teacher was not found in public.teachers. Run import_yazokulu_generated.sql first.';
  end if;
end $$;

insert into public.users (
  id,
  email,
  full_name,
  role,
  is_active
)
select
  auth_user_id,
  email,
  full_name,
  'teacher',
  true
from tmp_teacher_auth_links
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = excluded.is_active;

update public.teachers t
set
  user_id = l.auth_user_id,
  email = l.email,
  display_name = l.full_name,
  is_active = true
from tmp_teacher_auth_links l
where t.employee_code = l.employee_code;

commit;
