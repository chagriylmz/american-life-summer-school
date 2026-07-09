-- Enable the full Summer School teacher flow for imported Excel teachers.
--
-- This MVP keeps reads simple and allows authenticated teachers/coordinators to
-- update lesson status, mark attendance, and write lesson notes from the app.
-- The frontend filters teacher views by teachers.user_id = auth.uid().

begin;

alter table public.teachers enable row level security;
alter table public.lessons enable row level security;
alter table public.attendance enable row level security;
alter table public.lesson_notes enable row level security;

drop policy if exists "Summer school authenticated users can read teachers" on public.teachers;
drop policy if exists "Summer school authenticated users can read lessons" on public.lessons;
drop policy if exists "Summer school authenticated users can manage lessons" on public.lessons;
drop policy if exists "Summer school authenticated users can read attendance" on public.attendance;
drop policy if exists "Summer school authenticated users can manage attendance" on public.attendance;
drop policy if exists "Summer school authenticated users can read lesson notes" on public.lesson_notes;
drop policy if exists "Summer school authenticated users can manage lesson notes" on public.lesson_notes;

drop policy if exists "Teachers can read their own teacher profile" on public.teachers;
drop policy if exists "School staff can manage lessons" on public.lessons;
drop policy if exists "Summer school staff can manage lessons" on public.lessons;
drop policy if exists "School staff can manage attendance" on public.attendance;
drop policy if exists "Summer school staff can manage attendance" on public.attendance;
drop policy if exists "School staff can manage lesson notes" on public.lesson_notes;
drop policy if exists "Teachers can manage notes for their lessons" on public.lesson_notes;
drop policy if exists "Students can read non-private notes for their lessons" on public.lesson_notes;

create policy "Summer school authenticated users can read teachers"
on public.teachers for select
to authenticated
using (true);

create policy "Summer school authenticated users can read lessons"
on public.lessons for select
to authenticated
using (true);

create policy "Summer school authenticated users can manage lessons"
on public.lessons for update
to authenticated
using (true)
with check (true);

create policy "Summer school authenticated users can read attendance"
on public.attendance for select
to authenticated
using (true);

create policy "Summer school authenticated users can manage attendance"
on public.attendance for all
to authenticated
using (true)
with check (true);

create policy "Summer school authenticated users can read lesson notes"
on public.lesson_notes for select
to authenticated
using (true);

create policy "Summer school authenticated users can manage lesson notes"
on public.lesson_notes for all
to authenticated
using (true)
with check (true);

commit;
