-- Secure teacher completion helpers for previously started unfinished lessons.
--
-- These RPCs do not loosen the normal live-session RLS policies. They allow a
-- linked active teacher to complete only their own already-started,
-- still-unfinished, non-cancelled lesson on today or a previous date.

begin;

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
    'late_entry_updated',
    'student_transferred'
  )
);

create or replace function public.get_own_unfinished_teacher_lesson(
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
begin
  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select l.*
    into lesson_record
  from public.lessons l
  join public.teachers t on t.id = l.teacher_id
  where l.id = p_lesson_id
    and t.user_id = actor_id
    and t.is_active
  for update of l;

  if not found then
    raise exception 'You can only update your own unfinished lesson.';
  end if;

  if lesson_record.lesson_date > (timezone('Europe/Istanbul', now()))::date then
    raise exception 'Future lessons cannot be completed.';
  end if;

  if lesson_record.status = 'cancelled' then
    raise exception 'Cancelled lessons cannot be completed.';
  end if;

  if lesson_record.started_at is null then
    raise exception 'This lesson was never started.';
  end if;

  if lesson_record.finished_at is not null then
    raise exception 'This lesson has already been finished.';
  end if;

  return lesson_record;
end;
$$;

create or replace function public.save_teacher_unfinished_lesson_attendance(
  p_lesson_id uuid,
  p_student_id uuid,
  p_status public.attendance_status
)
returns public.attendance
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  lesson_record public.lessons%rowtype;
  attendance_record public.attendance%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  lesson_record := public.get_own_unfinished_teacher_lesson(p_lesson_id);

  if not exists (
    select 1
    from public.class_students cs
    where cs.class_id = lesson_record.class_id
      and cs.student_id = p_student_id
      and cs.status = 'active'
  ) then
    raise exception 'This student is not assigned to this lesson.';
  end if;

  insert into public.attendance (
    lesson_id,
    class_id,
    student_id,
    status,
    recorded_by,
    recorded_at
  )
  values (
    lesson_record.id,
    lesson_record.class_id,
    p_student_id,
    p_status,
    actor_id,
    now()
  )
  on conflict (lesson_id, student_id)
  do update set
    status = excluded.status,
    recorded_by = excluded.recorded_by,
    recorded_at = excluded.recorded_at
  returning * into attendance_record;

  return attendance_record;
end;
$$;

create or replace function public.save_teacher_unfinished_lesson_note(
  p_lesson_id uuid,
  p_body text
)
returns public.lesson_notes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  lesson_record public.lessons%rowtype;
  note_record public.lesson_notes%rowtype;
  existing_note_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'Lesson note must not be blank.';
  end if;

  lesson_record := public.get_own_unfinished_teacher_lesson(p_lesson_id);

  select ln.id
    into existing_note_id
  from public.lesson_notes ln
  where ln.lesson_id = lesson_record.id
    and ln.author_id = actor_id
  order by ln.created_at asc
  limit 1;

  if existing_note_id is null then
    insert into public.lesson_notes (
      lesson_id,
      author_id,
      title,
      body,
      is_private
    )
    values (
      lesson_record.id,
      actor_id,
      'Summer school note',
      p_body,
      false
    )
    returning * into note_record;
  else
    update public.lesson_notes
    set
      title = 'Summer school note',
      body = p_body,
      is_private = false
    where id = existing_note_id
    returning * into note_record;
  end if;

  return note_record;
end;
$$;

create or replace function public.finish_teacher_unfinished_lesson(
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
  finished_lesson public.lessons%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  lesson_record := public.get_own_unfinished_teacher_lesson(p_lesson_id);

  if not exists (
    select 1
    from public.lesson_notes ln
    where ln.lesson_id = lesson_record.id
      and ln.author_id = actor_id
      and length(trim(ln.body)) > 0
  ) then
    raise exception 'Lesson note must be saved before finishing the session.';
  end if;

  if exists (
    select 1
    from public.class_students cs
    where cs.class_id = lesson_record.class_id
      and cs.status = 'active'
      and not exists (
        select 1
        from public.attendance a
        where a.lesson_id = lesson_record.id
          and a.class_id = lesson_record.class_id
          and a.student_id = cs.student_id
          and a.status is not null
      )
  ) then
    raise exception 'Attendance must be completed before finishing the session.';
  end if;

  update public.lessons
  set
    finished_at = now(),
    status = 'completed'
  where id = lesson_record.id
    and started_at is not null
    and finished_at is null
    and status <> 'cancelled'
  returning * into finished_lesson;

  if not found then
    raise exception 'This lesson could not be finished.';
  end if;

  insert into public.activity_logs (
    action_type,
    lesson_id,
    teacher_id,
    actor_user_id,
    details
  )
  values (
    'historical_session_finished',
    finished_lesson.id,
    finished_lesson.teacher_id,
    actor_id,
    jsonb_build_object(
      'lesson_date', finished_lesson.lesson_date,
      'starts_at', finished_lesson.starts_at,
      'ends_at', finished_lesson.ends_at,
      'room', (
        select c.location
        from public.classes c
        where c.id = finished_lesson.class_id
      ),
      'late_completion', true,
      'finished_via', 'finish_teacher_unfinished_lesson'
    )
  );

  return finished_lesson;
end;
$$;

revoke all on function public.get_own_unfinished_teacher_lesson(uuid) from public;
revoke all on function public.save_teacher_unfinished_lesson_attendance(uuid, uuid, public.attendance_status) from public;
revoke all on function public.save_teacher_unfinished_lesson_note(uuid, text) from public;
revoke all on function public.finish_teacher_unfinished_lesson(uuid) from public;

grant execute on function public.save_teacher_unfinished_lesson_attendance(uuid, uuid, public.attendance_status) to authenticated;
grant execute on function public.save_teacher_unfinished_lesson_note(uuid, text) to authenticated;
grant execute on function public.finish_teacher_unfinished_lesson(uuid) to authenticated;

commit;
