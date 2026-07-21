-- Read-only diagnostic for Complete Retroactively roster mismatches.
--
-- Replace the UUID below with the failing public.lessons.id, then run the file
-- in Supabase SQL Editor. This does not modify data.

with params as (
  select '00000000-0000-0000-0000-000000000000'::uuid as lesson_id
),
target_lesson as (
  select l.*
  from public.lessons l
  join params p on p.lesson_id = l.id
),
expected_students as (
  select distinct cs.student_id
  from public.class_students cs
  join target_lesson l on l.class_id = cs.class_id
  where cs.joined_at <= l.lesson_date
    and (cs.left_at is null or cs.left_at >= l.lesson_date)
),
completed_attendance as (
  select distinct a.student_id
  from public.attendance a
  join target_lesson l on l.id = a.lesson_id
  where a.status is not null
),
missing_students as (
  select es.student_id
  from expected_students es
  left join completed_attendance ca on ca.student_id = es.student_id
  where ca.student_id is null
)
select
  'lesson' as section,
  l.id as lesson_id,
  l.class_id,
  l.teacher_id,
  l.lesson_date,
  l.starts_at,
  l.ends_at,
  l.status::text,
  l.started_at,
  l.finished_at,
  null::uuid as student_id,
  null::text as student_name,
  null::uuid as enrollment_class_id,
  null::date as joined_at,
  null::date as left_at,
  null::text as enrollment_status,
  null::uuid as attendance_id,
  null::text as attendance_status
from target_lesson l

union all

select
  'expected_roster' as section,
  l.id as lesson_id,
  l.class_id,
  l.teacher_id,
  l.lesson_date,
  l.starts_at,
  l.ends_at,
  l.status::text,
  l.started_at,
  l.finished_at,
  s.id as student_id,
  s.full_name as student_name,
  cs.class_id as enrollment_class_id,
  cs.joined_at,
  cs.left_at,
  cs.status::text as enrollment_status,
  a.id as attendance_id,
  a.status::text as attendance_status
from target_lesson l
join public.class_students cs on cs.class_id = l.class_id
join public.students s on s.id = cs.student_id
left join public.attendance a on a.lesson_id = l.id and a.student_id = s.id
where cs.joined_at <= l.lesson_date
  and (cs.left_at is null or cs.left_at >= l.lesson_date)

union all

select
  'missing_attendance' as section,
  l.id as lesson_id,
  l.class_id,
  l.teacher_id,
  l.lesson_date,
  l.starts_at,
  l.ends_at,
  l.status::text,
  l.started_at,
  l.finished_at,
  s.id as student_id,
  s.full_name as student_name,
  null::uuid as enrollment_class_id,
  null::date as joined_at,
  null::date as left_at,
  null::text as enrollment_status,
  null::uuid as attendance_id,
  null::text as attendance_status
from target_lesson l
join missing_students ms on true
join public.students s on s.id = ms.student_id

union all

select
  'overlapping_membership' as section,
  l.id as lesson_id,
  l.class_id,
  l.teacher_id,
  l.lesson_date,
  l.starts_at,
  l.ends_at,
  l.status::text,
  l.started_at,
  l.finished_at,
  s.id as student_id,
  s.full_name as student_name,
  cs.class_id as enrollment_class_id,
  cs.joined_at,
  cs.left_at,
  cs.status::text as enrollment_status,
  null::uuid as attendance_id,
  null::text as attendance_status
from target_lesson l
join expected_students es on true
join public.students s on s.id = es.student_id
join public.class_students cs on cs.student_id = es.student_id
where cs.joined_at <= l.lesson_date
  and (cs.left_at is null or cs.left_at >= l.lesson_date)
  and cs.class_id <> l.class_id
order by section, student_name nulls first, enrollment_class_id nulls first;
