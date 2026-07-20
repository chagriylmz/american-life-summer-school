-- Student Management: safe coordinator/admin student class/session transfer.
--
-- Run this in Supabase SQL Editor before using Student Management.
-- The transfer is intentionally performed by one transactional RPC instead of
-- several client-side writes.

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
    'late_entry_updated',
    'student_transferred'
  )
);

create or replace function public.transfer_student_class_session(
  p_student_id uuid,
  p_current_class_id uuid,
  p_target_class_id uuid,
  p_effective_date date,
  p_transfer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  student_record public.students%rowtype;
  current_enrollment public.class_students%rowtype;
  target_enrollment public.class_students%rowtype;
  current_class public.classes%rowtype;
  target_class public.classes%rowtype;
  current_teacher_name text;
  target_teacher_name text;
  current_time_label text;
  target_time_label text;
  conflict_dates date[];
begin
  if actor_id is null then
    raise exception 'You must be signed in to transfer students.';
  end if;

  if not public.current_user_has_role(array['admin', 'staff']::public.user_role[]) then
    raise exception 'Only admin or staff users can transfer students.';
  end if;

  if p_current_class_id = p_target_class_id then
    raise exception 'The new class/session must be different from the current class/session.';
  end if;

  if p_effective_date < date '2026-07-06' or p_effective_date > date '2026-08-12' then
    raise exception 'Effective date must be between 2026-07-06 and 2026-08-12.';
  end if;

  select *
  into student_record
  from public.students
  where id = p_student_id;

  if not found then
    raise exception 'Student was not found.';
  end if;

  select *
  into current_class
  from public.classes
  where id = p_current_class_id;

  if not found then
    raise exception 'Current class/session was not found.';
  end if;

  select *
  into target_class
  from public.classes
  where id = p_target_class_id;

  if not found then
    raise exception 'Target class/session was not found.';
  end if;

  select *
  into current_enrollment
  from public.class_students
  where class_id = p_current_class_id
    and student_id = p_student_id
  for update;

  if not found then
    raise exception 'The student is not assigned to the selected current class/session.';
  end if;

  if current_enrollment.status <> 'active' then
    raise exception 'The selected current assignment is not active.';
  end if;

  if current_enrollment.joined_at >= p_effective_date then
    raise exception 'Effective date must be after the current assignment start date.';
  end if;

  if current_enrollment.left_at is not null and current_enrollment.left_at < p_effective_date then
    raise exception 'The selected current assignment already ends before the effective date.';
  end if;

  select array_agg(distinct l.lesson_date order by l.lesson_date)
  into conflict_dates
  from public.attendance a
  join public.lessons l on l.id = a.lesson_id and l.class_id = a.class_id
  where a.student_id = p_student_id
    and l.class_id = p_current_class_id
    and l.lesson_date >= p_effective_date;

  if coalesce(array_length(conflict_dates, 1), 0) > 0 then
    raise exception
      'Transfer blocked. Attendance already exists in the current class on or after the effective date: %',
      array_to_string(conflict_dates, ', ');
  end if;

  select *
  into target_enrollment
  from public.class_students
  where class_id = p_target_class_id
    and student_id = p_student_id
  for update;

  if found then
    raise exception 'The student already has an assignment history in the target class/session.';
  end if;

  update public.class_students
  set
    status = 'completed',
    left_at = p_effective_date - 1,
    updated_at = now()
  where class_id = p_current_class_id
    and student_id = p_student_id;

  insert into public.class_students (
    class_id,
    student_id,
    status,
    joined_at,
    left_at
  )
  values (
    p_target_class_id,
    p_student_id,
    'active',
    p_effective_date,
    null
  )
  on conflict (class_id, student_id) do update
  set
    status = 'active',
    joined_at = excluded.joined_at,
    left_at = null,
    updated_at = now();

  select display_name
  into current_teacher_name
  from public.teachers
  where id = current_class.teacher_id;

  select display_name
  into target_teacher_name
  from public.teachers
  where id = target_class.teacher_id;

  select concat(to_char(l.starts_at, 'HH24:MI'), '-', to_char(l.ends_at, 'HH24:MI'))
  into current_time_label
  from public.lessons l
  where l.class_id = p_current_class_id
  order by l.lesson_date, l.starts_at
  limit 1;

  select concat(to_char(l.starts_at, 'HH24:MI'), '-', to_char(l.ends_at, 'HH24:MI'))
  into target_time_label
  from public.lessons l
  where l.class_id = p_target_class_id
  order by l.lesson_date, l.starts_at
  limit 1;

  insert into public.activity_logs (
    action_type,
    lesson_id,
    teacher_id,
    actor_user_id,
    details
  )
  values (
    'student_transferred',
    null,
    target_class.teacher_id,
    actor_id,
    jsonb_build_object(
      'student_id', student_record.id,
      'student_code', student_record.student_code,
      'student_name', student_record.full_name,
      'old_class_id', current_class.id,
      'old_class_name', current_class.name,
      'old_teacher', coalesce(current_teacher_name, 'Unassigned teacher'),
      'old_session_time', coalesce(current_time_label, 'Session time unavailable'),
      'old_room', current_class.location,
      'new_class_id', target_class.id,
      'new_class_name', target_class.name,
      'new_teacher', coalesce(target_teacher_name, 'Unassigned teacher'),
      'new_session_time', coalesce(target_time_label, 'Session time unavailable'),
      'new_room', target_class.location,
      'effective_date', p_effective_date,
      'transfer_note', nullif(trim(coalesce(p_transfer_note, '')), ''),
      'performed_by', actor_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'student_id', student_record.id,
    'old_class_id', current_class.id,
    'new_class_id', target_class.id,
    'effective_date', p_effective_date
  );
end;
$$;

revoke all on function public.transfer_student_class_session(uuid, uuid, uuid, date, text) from public;
grant execute on function public.transfer_student_class_session(uuid, uuid, uuid, date, text) to authenticated;

commit;
