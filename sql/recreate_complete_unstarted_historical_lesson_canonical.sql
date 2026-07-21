-- Canonicalize complete_unstarted_historical_lesson for PostgREST.
--
-- This script:
-- 1. Prints every currently deployed overload/copy named complete_unstarted_historical_lesson.
-- 2. Drops every overload in every schema.
-- 3. Recreates exactly one canonical public.complete_unstarted_historical_lesson(p_lesson_id uuid).
-- 4. Grants execute to authenticated.
-- 5. Reloads the PostgREST schema cache.

select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'complete_unstarted_historical_lesson'
order by n.nspname, pg_get_function_identity_arguments(p.oid);

do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'complete_unstarted_historical_lesson'
  loop
    raise notice 'Dropping %.%(%)', fn.schema_name, fn.function_name, fn.identity_arguments;
    execute format(
      'drop function if exists %I.%I(%s)',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );
  end loop;
end;
$$;

create or replace function public.complete_unstarted_historical_lesson(
  p_lesson_id uuid
)
returns public.lessons
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  lesson_record public.lessons%rowtype;
  completed_lesson public.lessons%rowtype;
  missing_student_ids uuid[];
  missing_student_names text[];
  missing_student_count integer;
  rpc_version text := 'RPC_VERSION_2026_07_TRANSFER_FIX';
begin
  if actor_id is null or not public.current_user_is_coordinator() then
    raise exception 'Only coordinators can complete historical lessons. [AUTH_CHECK] %', rpc_version;
  end if;

  select *
    into lesson_record
  from public.lessons
  where id = p_lesson_id
  for update;

  if not found then
    raise exception 'Lesson was not found. [LESSON_FOUND_CHECK] %', rpc_version;
  end if;

  if lesson_record.lesson_date >= (timezone('Europe/Istanbul', now()))::date then
    raise exception 'Only past lessons can be completed retroactively. [PAST_DATE_CHECK] %', rpc_version;
  end if;

  if lesson_record.status = 'cancelled' then
    raise exception 'Cancelled lessons cannot be completed. [CANCELLED_STATUS_CHECK] %', rpc_version;
  end if;

  if lesson_record.status = 'not_held' then
    raise exception 'Not held lessons cannot be completed. [NOT_HELD_STATUS_CHECK] %', rpc_version;
  end if;

  if lesson_record.started_at is not null or lesson_record.finished_at is not null then
    raise exception 'This workflow only completes lessons that were never started. [UNSTARTED_STATE_CHECK] %', rpc_version;
  end if;

  if not exists (
    select 1
    from public.lesson_notes ln
    where ln.lesson_id = lesson_record.id
      and length(trim(ln.body)) > 0
  ) then
    raise exception 'Lesson note must be saved before completing the session. [LESSON_NOTE_CHECK] %', rpc_version;
  end if;

  with expected_students as (
    select distinct cs.student_id
    from public.class_students cs
    where cs.class_id = lesson_record.class_id
      and cs.joined_at <= lesson_record.lesson_date
      and (cs.left_at is null or cs.left_at >= lesson_record.lesson_date)
  ),
  completed_attendance as (
    select distinct a.student_id
    from public.attendance a
    where a.lesson_id = lesson_record.id
      and a.status is not null
  ),
  missing_students as (
    select es.student_id, s.full_name
    from expected_students es
    left join completed_attendance ca on ca.student_id = es.student_id
    left join public.students s on s.id = es.student_id
    where ca.student_id is null
  )
  select
    coalesce(array_agg(ms.student_id order by coalesce(ms.full_name, ms.student_id::text)), array[]::uuid[]),
    coalesce(array_agg(coalesce(ms.full_name, ms.student_id::text) order by coalesce(ms.full_name, ms.student_id::text)), array[]::text[]),
    count(*)::integer
    into missing_student_ids, missing_student_names, missing_student_count
  from missing_students ms;

  if missing_student_count > 0 then
    raise exception 'Attendance must be completed before completing the session. [ATTENDANCE_COMPLETENESS_CHECK] % Missing attendance for % student(s): %',
      rpc_version,
      missing_student_count,
      array_to_string(missing_student_names, ', ')
      using detail = 'Missing student IDs: ' || array_to_string(missing_student_ids, ', ');
  end if;

  update public.lessons
  set
    started_at = now(),
    finished_at = now(),
    status = 'completed'
  where id = lesson_record.id
    and started_at is null
    and finished_at is null
    and status not in ('cancelled', 'not_held')
  returning * into completed_lesson;

  if not found then
    raise exception 'This historical lesson could not be completed. [FINAL_UPDATE_CHECK] %', rpc_version;
  end if;

  insert into public.activity_logs (
    action_type,
    lesson_id,
    teacher_id,
    actor_user_id,
    details
  )
  values (
    'retroactive_session_completed',
    completed_lesson.id,
    completed_lesson.teacher_id,
    actor_id,
    jsonb_build_object(
      'lesson_date', completed_lesson.lesson_date,
      'starts_at', completed_lesson.starts_at,
      'ends_at', completed_lesson.ends_at,
      'class_name', (
        select c.name
        from public.classes c
        where c.id = completed_lesson.class_id
      ),
      'room', (
        select c.location
        from public.classes c
        where c.id = completed_lesson.class_id
      ),
      'completed_retroactively', true,
      'rpc_version', rpc_version
    )
  );

  return completed_lesson;
end;
$$;

revoke all on function public.complete_unstarted_historical_lesson(uuid) from public;
grant execute on function public.complete_unstarted_historical_lesson(uuid) to authenticated;

notify pgrst, 'reload schema';

select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'complete_unstarted_historical_lesson'
order by n.nspname, pg_get_function_identity_arguments(p.oid);
