-- Restrict teacher writes to the live scheduled session window only.
--
-- Teachers may write attendance and lesson notes only for their own active
-- lessons where:
--   lessons.started_at is not null
--   lessons.finished_at is null
--   the current Istanbul date is the lesson date
--   the current Istanbul time is inside starts_at..ends_at
--
-- Coordinators/staff keep their existing policies for late entry and review.

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
      and (
        lessons.started_at is null
        or (
          lessons.started_at is not null
          and lessons.finished_at is null
          and lessons.lesson_date = (timezone('Europe/Istanbul', now()))::date
          and (timezone('Europe/Istanbul', now()))::time between lessons.starts_at and lessons.ends_at
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.teachers t
    where t.id = lessons.teacher_id
      and t.user_id = auth.uid()
      and t.is_active
      and lessons.started_at is not null
      and lessons.lesson_date = (timezone('Europe/Istanbul', now()))::date
      and (timezone('Europe/Istanbul', now()))::time between lessons.starts_at and lessons.ends_at
      and (
        lessons.finished_at is null
        or (
          exists (
            select 1
            from public.lesson_notes ln
            where ln.lesson_id = lessons.id
              and ln.author_id = auth.uid()
              and length(trim(ln.body)) > 0
          )
          and not exists (
            select 1
            from public.class_students cs
            where cs.class_id = lessons.class_id
              and not exists (
                select 1
                from public.attendance a
                where a.lesson_id = lessons.id
                  and a.class_id = lessons.class_id
                  and a.student_id = cs.student_id
                  and a.status is not null
              )
          )
        )
      )
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
  recorded_by = auth.uid()
  and exists (
    select 1
    from public.lessons l
    join public.teachers t on t.id = l.teacher_id
    join public.class_students cs on cs.class_id = l.class_id and cs.student_id = attendance.student_id
    where l.id = attendance.lesson_id
      and l.class_id = attendance.class_id
      and t.user_id = auth.uid()
      and t.is_active
      and l.started_at is not null
      and l.finished_at is null
      and l.lesson_date = (timezone('Europe/Istanbul', now()))::date
      and (timezone('Europe/Istanbul', now()))::time between l.starts_at and l.ends_at
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
      and l.started_at is not null
      and l.finished_at is null
      and l.lesson_date = (timezone('Europe/Istanbul', now()))::date
      and (timezone('Europe/Istanbul', now()))::time between l.starts_at and l.ends_at
  )
)
with check (
  recorded_by = auth.uid()
  and exists (
    select 1
    from public.lessons l
    join public.teachers t on t.id = l.teacher_id
    join public.class_students cs on cs.class_id = l.class_id and cs.student_id = attendance.student_id
    where l.id = attendance.lesson_id
      and l.class_id = attendance.class_id
      and t.user_id = auth.uid()
      and t.is_active
      and l.started_at is not null
      and l.finished_at is null
      and l.lesson_date = (timezone('Europe/Istanbul', now()))::date
      and (timezone('Europe/Istanbul', now()))::time between l.starts_at and l.ends_at
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
      and l.started_at is not null
      and l.finished_at is null
      and l.lesson_date = (timezone('Europe/Istanbul', now()))::date
      and (timezone('Europe/Istanbul', now()))::time between l.starts_at and l.ends_at
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
      and l.started_at is not null
      and l.finished_at is null
      and l.lesson_date = (timezone('Europe/Istanbul', now()))::date
      and (timezone('Europe/Istanbul', now()))::time between l.starts_at and l.ends_at
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
      and l.started_at is not null
      and l.finished_at is null
      and l.lesson_date = (timezone('Europe/Istanbul', now()))::date
      and (timezone('Europe/Istanbul', now()))::time between l.starts_at and l.ends_at
  )
);

commit;
