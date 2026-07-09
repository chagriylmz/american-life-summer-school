-- Allow teachers to access only their own Summer School workflow rows.
--
-- This keeps existing coordinator/staff policies intact and adds narrow teacher
-- access based on:
--   public.lessons.teacher_id = public.teachers.id
--   public.teachers.user_id = auth.uid()

begin;

alter table public.lessons enable row level security;
alter table public.attendance enable row level security;
alter table public.lesson_notes enable row level security;

drop policy if exists "Teachers can update own summer school lessons" on public.lessons;
drop policy if exists "Teachers can read attendance for own summer school lessons" on public.attendance;
drop policy if exists "Teachers can insert attendance for own summer school lessons" on public.attendance;
drop policy if exists "Teachers can update attendance for own summer school lessons" on public.attendance;
drop policy if exists "Teachers can read notes for own summer school lessons" on public.lesson_notes;
drop policy if exists "Teachers can insert notes for own summer school lessons" on public.lesson_notes;
drop policy if exists "Teachers can update notes for own summer school lessons" on public.lesson_notes;

create policy "Teachers can update own summer school lessons"
on public.lessons for update
to authenticated
using (
  exists (
    select 1
    from public.teachers t
    where t.id = lessons.teacher_id
      and t.user_id = auth.uid()
      and t.is_active
  )
)
with check (
  exists (
    select 1
    from public.teachers t
    where t.id = lessons.teacher_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

create policy "Teachers can read attendance for own summer school lessons"
on public.attendance for select
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    join public.teachers t on t.id = l.teacher_id
    where l.id = attendance.lesson_id
      and l.class_id = attendance.class_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

create policy "Teachers can insert attendance for own summer school lessons"
on public.attendance for insert
to authenticated
with check (
  exists (
    select 1
    from public.lessons l
    join public.teachers t on t.id = l.teacher_id
    where l.id = attendance.lesson_id
      and l.class_id = attendance.class_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

create policy "Teachers can update attendance for own summer school lessons"
on public.attendance for update
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    join public.teachers t on t.id = l.teacher_id
    where l.id = attendance.lesson_id
      and l.class_id = attendance.class_id
      and t.user_id = auth.uid()
      and t.is_active
  )
)
with check (
  exists (
    select 1
    from public.lessons l
    join public.teachers t on t.id = l.teacher_id
    where l.id = attendance.lesson_id
      and l.class_id = attendance.class_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

create policy "Teachers can read notes for own summer school lessons"
on public.lesson_notes for select
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    join public.teachers t on t.id = l.teacher_id
    where l.id = lesson_notes.lesson_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

create policy "Teachers can insert notes for own summer school lessons"
on public.lesson_notes for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.lessons l
    join public.teachers t on t.id = l.teacher_id
    where l.id = lesson_notes.lesson_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

create policy "Teachers can update notes for own summer school lessons"
on public.lesson_notes for update
to authenticated
using (
  author_id = auth.uid()
  and exists (
    select 1
    from public.lessons l
    join public.teachers t on t.id = l.teacher_id
    where l.id = lesson_notes.lesson_id
      and t.user_id = auth.uid()
      and t.is_active
  )
)
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.lessons l
    join public.teachers t on t.id = l.teacher_id
    where l.id = lesson_notes.lesson_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

commit;
