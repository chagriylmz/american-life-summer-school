-- Safely cancel approved visible Summer School lesson rows after the real end date.
--
-- Summer School runs from 2026-07-06 through 2026-08-12.
-- This script targets only the approved visible yazokulu import dataset and
-- cancels invalid post-end-date lesson rows. It does not delete lessons.
--
-- Safety behavior:
-- - Aborts if any targeted lesson has attendance.
-- - Does not modify lessons on or before 2026-08-12.
-- - Does not modify unrelated classes/courses.

begin;

do $$
declare
  summer_school_end_date constant date := date '2026-08-12';
  invalid_lesson_count integer;
  attendance_linked_lesson_count integer;
  cancelled_lesson_count integer;
  affected_dates text[];
begin
  create temp table tmp_invalid_visible_yazokulu_lessons on commit drop as
  select
    l.id,
    l.class_id,
    l.lesson_date,
    l.starts_at,
    l.ends_at,
    l.status,
    c.name as class_name,
    c.location,
    t.employee_code,
    t.display_name as teacher_name
  from public.lessons l
  join public.classes c on c.id = l.class_id
  join public.teachers t on t.id = l.teacher_id
  where l.lesson_date > summer_school_end_date
    and l.status <> 'cancelled'
    and l.title like 'Summer School Session - %'
    and c.name like 'American Life Summer School - %'
    and c.schedule->0->>'source_sheet' = 'YAZ OKULU-SINIF PLANLANMASI(TAS'
    and t.employee_code in ('YAZ-HUMEYRA', 'YAZ-ONUR', 'YAZ-SEVDE', 'YAZ-KIMIA');

  select count(*)
  into invalid_lesson_count
  from tmp_invalid_visible_yazokulu_lessons;

  select coalesce(array_agg(distinct lesson_date::text order by lesson_date::text), array[]::text[])
  into affected_dates
  from tmp_invalid_visible_yazokulu_lessons;

  select count(distinct target.id)
  into attendance_linked_lesson_count
  from tmp_invalid_visible_yazokulu_lessons target
  join public.attendance a on a.lesson_id = target.id;

  if attendance_linked_lesson_count > 0 then
    raise exception
      'Aborting: % invalid post-2026-08-12 visible Summer School lesson row(s) have attendance. No lessons were cancelled. Affected dates: %',
      attendance_linked_lesson_count,
      array_to_string(affected_dates, ', ');
  end if;

  update public.lessons l
  set
    status = 'cancelled',
    updated_at = now()
  from tmp_invalid_visible_yazokulu_lessons target
  where l.id = target.id;

  get diagnostics cancelled_lesson_count = row_count;

  raise notice 'Invalid visible Summer School lessons found: %', invalid_lesson_count;
  raise notice 'Invalid visible Summer School lessons cancelled: %', cancelled_lesson_count;
  raise notice 'Attendance-linked invalid lessons found: %', attendance_linked_lesson_count;
  raise notice 'Affected lesson dates: %', coalesce(array_to_string(affected_dates, ', '), '(none)');
end $$;

with targeted_lessons as (
  select
    l.id,
    l.lesson_date,
    l.starts_at,
    l.ends_at,
    l.status,
    c.name as class_name,
    c.location,
    t.display_name as teacher_name,
    count(a.id) as attendance_count
  from public.lessons l
  join public.classes c on c.id = l.class_id
  join public.teachers t on t.id = l.teacher_id
  left join public.attendance a on a.lesson_id = l.id
  where l.lesson_date > date '2026-08-12'
    and l.title like 'Summer School Session - %'
    and c.name like 'American Life Summer School - %'
    and c.schedule->0->>'source_sheet' = 'YAZ OKULU-SINIF PLANLANMASI(TAS'
    and t.employee_code in ('YAZ-HUMEYRA', 'YAZ-ONUR', 'YAZ-SEVDE', 'YAZ-KIMIA')
  group by
    l.id,
    l.lesson_date,
    l.starts_at,
    l.ends_at,
    l.status,
    c.name,
    c.location,
    t.display_name
)
select
  count(*) as invalid_lessons_after_end_date,
  count(*) filter (where status = 'cancelled') as cancelled_lessons_after_end_date,
  count(*) filter (where attendance_count > 0) as attendance_linked_lessons_after_end_date,
  coalesce(array_agg(distinct lesson_date order by lesson_date), array[]::date[]) as affected_lesson_dates
from targeted_lessons;

commit;
