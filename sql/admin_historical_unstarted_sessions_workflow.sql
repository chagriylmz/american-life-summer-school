-- Admin/coordinator workflow for historical lessons that were never started.
--
-- Run this once in Supabase SQL Editor before using the Unstarted Past Sessions
-- section in the app.

alter type public.lesson_status add value if not exists 'not_held';

alter table public.activity_logs
drop constraint if exists activity_logs_action_type_check;

alter table public.activity_logs
add constraint activity_logs_action_type_check check (
  action_type in (
    'session_started',
    'attendance_updated',
    'lesson_note_saved',
    'session_finished',
    'historical_session_finished',
    'retroactive_session_completed',
    'historical_session_cancelled',
    'historical_session_not_held',
    'late_entry_updated',
    'student_transferred'
  )
);

create or replace function public.current_user_is_coordinator()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.is_active
      and u.role in ('admin', 'staff')
  );
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
begin
  if actor_id is null or not public.current_user_is_coordinator() then
    raise exception 'Only coordinators can complete historical lessons. [AUTH_CHECK]';
  end if;

  select *
    into lesson_record
  from public.lessons
  where id = p_lesson_id
  for update;

  if not found then
    raise exception 'Lesson was not found. [LESSON_FOUND_CHECK]';
  end if;

  if lesson_record.lesson_date >= (timezone('Europe/Istanbul', now()))::date then
    raise exception 'Only past lessons can be completed retroactively. [PAST_DATE_CHECK]';
  end if;

  if lesson_record.status = 'cancelled' then
    raise exception 'Cancelled lessons cannot be completed. [CANCELLED_STATUS_CHECK]';
  end if;

  if lesson_record.status = 'not_held' then
    raise exception 'Not held lessons cannot be completed. [NOT_HELD_STATUS_CHECK]';
  end if;

  if lesson_record.started_at is not null or lesson_record.finished_at is not null then
    raise exception 'This workflow only completes lessons that were never started. [UNSTARTED_STATE_CHECK]';
  end if;

  if not exists (
    select 1
    from public.lesson_notes ln
    where ln.lesson_id = lesson_record.id
      and length(trim(ln.body)) > 0
  ) then
    raise exception 'Lesson note must be saved before completing the session. [LESSON_NOTE_CHECK]';
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
    raise exception 'Attendance must be completed before completing the session. [ATTENDANCE_COMPLETENESS_CHECK] Missing attendance for % student(s): %',
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
    raise exception 'This historical lesson could not be completed. [FINAL_UPDATE_CHECK]';
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
      'completed_retroactively', true
    )
  );

  return completed_lesson;
end;
$$;

create or replace function public.cancel_unstarted_historical_lesson(
  p_lesson_id uuid,
  p_reason text
)
returns public.lessons
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  lesson_record public.lessons%rowtype;
  cancelled_lesson public.lessons%rowtype;
  reason_text text := trim(coalesce(p_reason, ''));
begin
  if actor_id is null or not public.current_user_is_coordinator() then
    raise exception 'Only coordinators can cancel historical lessons.';
  end if;

  if length(reason_text) = 0 then
    raise exception 'Cancellation reason is required.';
  end if;

  select *
    into lesson_record
  from public.lessons
  where id = p_lesson_id
  for update;

  if not found then
    raise exception 'Lesson was not found.';
  end if;

  if lesson_record.lesson_date >= (timezone('Europe/Istanbul', now()))::date then
    raise exception 'Only past lessons can be cancelled through this workflow.';
  end if;

  if lesson_record.started_at is not null or lesson_record.finished_at is not null then
    raise exception 'This workflow only cancels lessons that were never started.';
  end if;

  if lesson_record.status = 'cancelled' then
    raise exception 'This lesson is already cancelled.';
  end if;

  update public.lessons
  set status = 'cancelled'
  where id = lesson_record.id
    and started_at is null
    and finished_at is null
    and status <> 'cancelled'
  returning * into cancelled_lesson;

  if not found then
    raise exception 'This historical lesson could not be cancelled.';
  end if;

  insert into public.activity_logs (
    action_type,
    lesson_id,
    teacher_id,
    actor_user_id,
    details
  )
  values (
    'historical_session_cancelled',
    cancelled_lesson.id,
    cancelled_lesson.teacher_id,
    actor_id,
    jsonb_build_object(
      'lesson_date', cancelled_lesson.lesson_date,
      'starts_at', cancelled_lesson.starts_at,
      'ends_at', cancelled_lesson.ends_at,
      'class_name', (
        select c.name
        from public.classes c
        where c.id = cancelled_lesson.class_id
      ),
      'room', (
        select c.location
        from public.classes c
        where c.id = cancelled_lesson.class_id
      ),
      'reason', reason_text
    )
  );

  return cancelled_lesson;
end;
$$;

create or replace function public.mark_unstarted_historical_lesson_not_held(
  p_lesson_id uuid,
  p_reason text default null
)
returns public.lessons
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  lesson_record public.lessons%rowtype;
  not_held_lesson public.lessons%rowtype;
  reason_text text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if actor_id is null or not public.current_user_is_coordinator() then
    raise exception 'Only coordinators can mark historical lessons not held.';
  end if;

  select *
    into lesson_record
  from public.lessons
  where id = p_lesson_id
  for update;

  if not found then
    raise exception 'Lesson was not found.';
  end if;

  if lesson_record.lesson_date >= (timezone('Europe/Istanbul', now()))::date then
    raise exception 'Only past lessons can be marked not held through this workflow.';
  end if;

  if lesson_record.started_at is not null or lesson_record.finished_at is not null then
    raise exception 'This workflow only marks lessons that were never started.';
  end if;

  if lesson_record.status = 'cancelled' then
    raise exception 'Cancelled lessons cannot be marked not held.';
  end if;

  update public.lessons
  set status = 'not_held'
  where id = lesson_record.id
    and started_at is null
    and finished_at is null
    and status not in ('cancelled', 'not_held')
  returning * into not_held_lesson;

  if not found then
    raise exception 'This historical lesson could not be marked not held.';
  end if;

  insert into public.activity_logs (
    action_type,
    lesson_id,
    teacher_id,
    actor_user_id,
    details
  )
  values (
    'historical_session_not_held',
    not_held_lesson.id,
    not_held_lesson.teacher_id,
    actor_id,
    jsonb_build_object(
      'lesson_date', not_held_lesson.lesson_date,
      'starts_at', not_held_lesson.starts_at,
      'ends_at', not_held_lesson.ends_at,
      'class_name', (
        select c.name
        from public.classes c
        where c.id = not_held_lesson.class_id
      ),
      'room', (
        select c.location
        from public.classes c
        where c.id = not_held_lesson.class_id
      ),
      'reason', reason_text
    )
  );

  return not_held_lesson;
end;
$$;

revoke all on function public.current_user_is_coordinator() from public;
revoke all on function public.complete_unstarted_historical_lesson(uuid) from public;
revoke all on function public.cancel_unstarted_historical_lesson(uuid, text) from public;
revoke all on function public.mark_unstarted_historical_lesson_not_held(uuid, text) from public;

grant execute on function public.complete_unstarted_historical_lesson(uuid) to authenticated;
grant execute on function public.cancel_unstarted_historical_lesson(uuid, text) to authenticated;
grant execute on function public.mark_unstarted_historical_lesson_not_held(uuid, text) to authenticated;
