-- Fix recursive RLS policies for the Summer School MVP.
-- This migration removes cross-table policy checks that can recurse between
-- classes, class_students, lessons, and attendance.
--
-- MVP policy model:
-- - Authenticated users can read app data needed by the dashboards.
-- - Admin/staff users can manage operational summer school data.
-- - Users can read/update only their own public.users profile.

begin;

alter table public.users enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;
alter table public.lessons enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "Users can read their own profile" on public.users;
drop policy if exists "Admins and staff can read all users" on public.users;
drop policy if exists "Users can update their own profile" on public.users;

drop policy if exists "School staff can manage classes" on public.classes;
drop policy if exists "Teachers can read their own classes" on public.classes;
drop policy if exists "Students can read their enrolled classes" on public.classes;

drop policy if exists "School staff can manage class enrollments" on public.class_students;
drop policy if exists "Teachers can read enrollments for their classes" on public.class_students;
drop policy if exists "Students can read their own enrollments" on public.class_students;

drop policy if exists "School staff can manage lessons" on public.lessons;
drop policy if exists "Teachers can manage lessons for their classes" on public.lessons;
drop policy if exists "Students can read lessons for enrolled classes" on public.lessons;

drop policy if exists "School staff can manage attendance" on public.attendance;
drop policy if exists "Teachers can manage attendance for their classes" on public.attendance;
drop policy if exists "Students can read their own attendance" on public.attendance;

drop policy if exists "Summer school users can read own profile" on public.users;
drop policy if exists "Summer school users can update own profile" on public.users;
drop policy if exists "Summer school authenticated users can read classes" on public.classes;
drop policy if exists "Summer school staff can manage classes" on public.classes;
drop policy if exists "Summer school authenticated users can read enrollments" on public.class_students;
drop policy if exists "Summer school staff can manage enrollments" on public.class_students;
drop policy if exists "Summer school authenticated users can read lessons" on public.lessons;
drop policy if exists "Summer school staff can manage lessons" on public.lessons;
drop policy if exists "Summer school authenticated users can read attendance" on public.attendance;
drop policy if exists "Summer school staff can manage attendance" on public.attendance;

create policy "Summer school users can read own profile"
on public.users for select
to authenticated
using (id = auth.uid());

create policy "Summer school users can update own profile"
on public.users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Summer school authenticated users can read classes"
on public.classes for select
to authenticated
using (true);

create policy "Summer school staff can manage classes"
on public.classes for all
to authenticated
using (public.current_user_has_role(array['admin', 'staff']::public.user_role[]))
with check (public.current_user_has_role(array['admin', 'staff']::public.user_role[]));

create policy "Summer school authenticated users can read enrollments"
on public.class_students for select
to authenticated
using (true);

create policy "Summer school staff can manage enrollments"
on public.class_students for all
to authenticated
using (public.current_user_has_role(array['admin', 'staff']::public.user_role[]))
with check (public.current_user_has_role(array['admin', 'staff']::public.user_role[]));

create policy "Summer school authenticated users can read lessons"
on public.lessons for select
to authenticated
using (true);

create policy "Summer school staff can manage lessons"
on public.lessons for all
to authenticated
using (public.current_user_has_role(array['admin', 'staff']::public.user_role[]))
with check (public.current_user_has_role(array['admin', 'staff']::public.user_role[]));

create policy "Summer school authenticated users can read attendance"
on public.attendance for select
to authenticated
using (true);

create policy "Summer school staff can manage attendance"
on public.attendance for all
to authenticated
using (public.current_user_has_role(array['admin', 'staff']::public.user_role[]))
with check (public.current_user_has_role(array['admin', 'staff']::public.user_role[]));

commit;
