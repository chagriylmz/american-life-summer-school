-- Repair approved visible yazokulu.xlsx summer school dates and lesson weekdays.
--
-- Problem source:
-- sql/import_visible_yazokulu_approved.sql originally used current_date for:
-- - public.classes.start_date
-- - public.classes.end_date
-- - public.lessons.lesson_date
-- - public.class_students.joined_at
--
-- Correct schedule:
-- - First lesson date: 2026-07-06
-- - Teaching weekdays: Monday, Tuesday, Wednesday
--
-- Safety:
-- - Targets only approved visible-sheet summer school classes imported with YAZ teachers.
-- - Updates one existing lesson row per session in place to 2026-07-06, preserving lesson IDs and attendance FKs.
-- - Inserts missing Monday/Tuesday/Wednesday lesson rows using the existing unique key.
-- - Does not delete attendance, lesson notes, class_students, students, teachers, or classes.
-- - Cancels only extra non-Mon/Tue/Wed lesson rows that have no attendance attached.
-- - Aborts if a non-Mon/Tue/Wed lesson row has attendance attached after the repair step.

begin;

do $$
declare
  target_start_date constant date := date '2026-07-06';
  expected_class_count constant integer := 7;
  affected_class_count integer;
  moved_lesson_count integer;
  inserted_or_updated_lesson_count integer;
  invalid_attendance_linked_lesson_count integer;
begin
  create temp table tmp_visible_yazokulu_classes on commit drop as
  select
    c.id as class_id,
    c.teacher_id,
    c.name,
    c.start_date,
    c.end_date,
    c.location,
    (c.schedule->0->>'starts_at')::time as starts_at,
    (c.schedule->0->>'ends_at')::time as ends_at,
    t.display_name as teacher_name
  from public.classes c
  join public.teachers t on t.id = c.teacher_id
  where t.employee_code like 'YAZ-%'
    and c.name like 'American Life Summer School - %'
    and c.schedule @> '[{"source_sheet":"YAZ OKULU-SINIF PLANLANMASI(TAS"}]'::jsonb;

  select count(*) into affected_class_count
  from tmp_visible_yazokulu_classes;

  if affected_class_count <> expected_class_count then
    raise exception
      'Expected % approved visible summer school classes, found %. Aborting so unrelated classes are not changed.',
      expected_class_count,
      affected_class_count;
  end if;

  update public.classes c
  set
    start_date = target_start_date,
    end_date = target_start_date + interval '8 weeks',
    updated_at = now()
  from tmp_visible_yazokulu_classes target
  where c.id = target.class_id;

  create temp table tmp_primary_visible_yazokulu_lessons on commit drop as
  with ranked_lessons as (
    select
      l.id as lesson_id,
      l.class_id,
      l.lesson_date,
      l.starts_at,
      row_number() over (
        partition by l.class_id
        order by
          case when l.lesson_date = target_start_date then 0 else 1 end,
          l.created_at,
          l.id
      ) as row_number
    from public.lessons l
    join tmp_visible_yazokulu_classes c on c.class_id = l.class_id
    where l.title like 'Summer School Session - %'
      and l.status <> 'cancelled'
  )
  select lesson_id, class_id, lesson_date, starts_at
  from ranked_lessons
  where row_number = 1;

  update public.lessons l
  set
    lesson_date = target_start_date,
    updated_at = now()
  from tmp_primary_visible_yazokulu_lessons target
  where l.id = target.lesson_id
    and l.lesson_date <> target_start_date;

  get diagnostics moved_lesson_count = row_count;

  insert into public.lessons (
    class_id,
    teacher_id,
    lesson_date,
    starts_at,
    ends_at,
    title,
    objectives,
    materials,
    homework,
    status
  )
  select
    c.class_id,
    c.teacher_id,
    lesson_day::date,
    c.starts_at,
    c.ends_at,
    'Summer School Session - ' || c.teacher_name || ' ' || coalesce(c.location, ''),
    'Imported from visible yazokulu.xlsx worksheet.',
    null,
    null,
    'scheduled'
  from tmp_visible_yazokulu_classes c
  cross join generate_series(
    target_start_date,
    target_start_date + interval '8 weeks',
    interval '1 day'
  ) as lesson_days(lesson_day)
  where extract(isodow from lesson_day) in (1, 2, 3)
  on conflict (class_id, lesson_date, starts_at) do update
  set
    teacher_id = excluded.teacher_id,
    ends_at = excluded.ends_at,
    title = excluded.title,
    objectives = excluded.objectives,
    status = excluded.status;

  get diagnostics inserted_or_updated_lesson_count = row_count;

  select count(*) into invalid_attendance_linked_lesson_count
  from public.lessons l
  join tmp_visible_yazokulu_classes c on c.class_id = l.class_id
  where l.status <> 'cancelled'
    and l.title like 'Summer School Session - %'
    and extract(isodow from l.lesson_date) not in (1, 2, 3)
    and exists (
      select 1
      from public.attendance a
      where a.lesson_id = l.id
    );

  if invalid_attendance_linked_lesson_count > 0 then
    raise exception
      'Found % attendance-linked summer school lesson row(s) outside Monday/Tuesday/Wednesday. Aborting.',
      invalid_attendance_linked_lesson_count;
  end if;

  update public.lessons l
  set
    status = 'cancelled',
    updated_at = now()
  from tmp_visible_yazokulu_classes c
  where l.class_id = c.class_id
    and l.status <> 'cancelled'
    and l.title like 'Summer School Session - %'
    and extract(isodow from l.lesson_date) not in (1, 2, 3)
    and not exists (
      select 1
      from public.attendance a
      where a.lesson_id = l.id
    );

  update public.class_students cs
  set joined_at = target_start_date
  from tmp_visible_yazokulu_classes target
  join public.students s on s.student_code like 'YAZ-VISIBLE-%'
  where cs.class_id = target.class_id
    and cs.student_id = s.id
    and (cs.joined_at is null or cs.joined_at <> target_start_date);

  if exists (
    select 1
    from public.lessons l
    join tmp_visible_yazokulu_classes c on c.class_id = l.class_id
    where l.status <> 'cancelled'
      and l.title like 'Summer School Session - %'
      and l.lesson_date < target_start_date
  ) then
    raise exception 'Found active summer school lesson rows before 2026-07-06. Aborting.';
  end if;

  if exists (
    select 1
    from public.lessons l
    join tmp_visible_yazokulu_classes c on c.class_id = l.class_id
    where l.status <> 'cancelled'
      and l.title like 'Summer School Session - %'
      and extract(isodow from l.lesson_date) not in (1, 2, 3)
  ) then
    raise exception 'Found active summer school lesson rows outside Monday/Tuesday/Wednesday. Aborting.';
  end if;

  raise notice 'Repaired % classes. Moved % existing lesson row(s). Inserted/updated % Mon/Tue/Wed lesson occurrence row(s).',
    affected_class_count,
    moved_lesson_count,
    inserted_or_updated_lesson_count;
end $$;

commit;

-- Verification query:
-- select
--   min(c.start_date) as first_class_start_date,
--   min(l.lesson_date) as first_lesson_date,
--   count(distinct c.id) as class_count,
--   count(distinct l.id) filter (where l.status <> 'cancelled') as active_lesson_count,
--   count(*) filter (where extract(isodow from l.lesson_date) = 4 and l.status <> 'cancelled') as active_thursday_lessons,
--   count(*) filter (where extract(isodow from l.lesson_date) not in (1, 2, 3) and l.status <> 'cancelled') as active_non_monday_tuesday_wednesday_lessons
-- from public.classes c
-- join public.teachers t on t.id = c.teacher_id
-- join public.lessons l on l.class_id = c.id
-- where t.employee_code like 'YAZ-%'
--   and c.name like 'American Life Summer School - %'
--   and c.schedule @> '[{"source_sheet":"YAZ OKULU-SINIF PLANLANMASI(TAS"}]'::jsonb;
