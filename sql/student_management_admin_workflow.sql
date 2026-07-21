-- Student Management: coordinator/admin create, enroll, update, and transfer RPCs.
--
-- Run this in Supabase SQL Editor before using the expanded Student Management UI.

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
    'retroactive_session_completed',
    'historical_session_cancelled',
    'historical_session_not_held',
    'late_entry_updated',
    'student_created',
    'student_enrolled',
    'student_transferred',
    'student_details_updated'
  )
);

create or replace function public.normalize_guardian_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if length(trim(coalesce(p_phone, ''))) = 0 then
    return null;
  end if;

  if length(digits) = 10 then
    return '0' || digits;
  end if;

  if length(digits) = 11 and left(digits, 1) = '0' then
    return digits;
  end if;

  if length(digits) = 12 and left(digits, 2) = '90' then
    return '0' || substring(digits from 3);
  end if;

  return digits;
end;
$$;

create or replace function public.normalize_student_name(p_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.current_user_is_student_manager()
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

create or replace function public.create_student_with_enrollment(
  p_full_name text,
  p_student_code text,
  p_birth_year integer,
  p_guardian_phone text,
  p_class_id uuid,
  p_joined_at date,
  p_force_create boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_is_admin boolean;
  normalized_phone text := public.normalize_guardian_phone(p_guardian_phone);
  normalized_name text := public.normalize_student_name(p_full_name);
  new_student public.students%rowtype;
  target_class public.classes%rowtype;
  possible_duplicate jsonb;
begin
  if actor_id is null or not public.current_user_is_student_manager() then
    raise exception 'Only admin or staff users can create students.';
  end if;

  select u.role = 'admin'
    into actor_is_admin
  from public.users u
  where u.id = actor_id;

  if length(trim(coalesce(p_full_name, ''))) = 0 then
    raise exception 'Full name is required.';
  end if;

  if length(trim(coalesce(p_student_code, ''))) = 0 then
    raise exception 'Student code is required.';
  end if;

  if p_birth_year is not null and (p_birth_year < 1900 or p_birth_year > extract(year from current_date)::integer + 1) then
    raise exception 'Birth year is invalid.';
  end if;

  if p_joined_at is null then
    raise exception 'Enrollment start date is required.';
  end if;

  select *
    into target_class
  from public.classes
  where id = p_class_id;

  if not found then
    raise exception 'Class/session was not found.';
  end if;

  if exists (
    select 1 from public.students s where s.student_code = trim(p_student_code)
  ) then
    raise exception 'A student with this student code already exists.';
  end if;

  select jsonb_agg(jsonb_build_object(
    'id', s.id,
    'full_name', s.full_name,
    'student_code', s.student_code,
    'guardian_phone', s.guardian_phone,
    'match_reason',
      case
        when normalized_phone is not null and public.normalize_guardian_phone(s.guardian_phone) = normalized_phone and public.normalize_student_name(s.full_name) = normalized_name then 'name_and_phone'
        when normalized_phone is not null and public.normalize_guardian_phone(s.guardian_phone) = normalized_phone then 'phone'
        else 'name'
      end
  ))
    into possible_duplicate
  from public.students s
  where (
    normalized_phone is not null and public.normalize_guardian_phone(s.guardian_phone) = normalized_phone
  )
  or (
    normalized_phone is not null
    and public.normalize_guardian_phone(s.guardian_phone) = normalized_phone
    and public.normalize_student_name(s.full_name) = normalized_name
  );

  if possible_duplicate is not null and not p_force_create then
    raise exception 'Possible existing student found: %', possible_duplicate;
  end if;

  if possible_duplicate is not null and p_force_create and not actor_is_admin then
    raise exception 'Only admin users can create anyway after a possible duplicate match.';
  end if;

  insert into public.students (
    full_name,
    student_code,
    guardian_phone,
    date_of_birth,
    native_language,
    target_language,
    current_level,
    enrollment_date,
    is_active
  )
  values (
    regexp_replace(trim(p_full_name), '\s+', ' ', 'g'),
    trim(p_student_code),
    normalized_phone,
    case when p_birth_year is null then null else make_date(p_birth_year, 1, 1) end,
    'Turkish',
    'English',
    'beginner',
    p_joined_at,
    true
  )
  returning * into new_student;

  insert into public.class_students (
    class_id,
    student_id,
    status,
    joined_at,
    left_at
  )
  values (
    p_class_id,
    new_student.id,
    'active',
    p_joined_at,
    null
  );

  insert into public.activity_logs (
    action_type,
    lesson_id,
    teacher_id,
    actor_user_id,
    details
  )
  values (
    'student_created',
    null,
    target_class.teacher_id,
    actor_id,
    jsonb_build_object(
      'student_id', new_student.id,
      'student_code', new_student.student_code,
      'student_name', new_student.full_name,
      'class_id', target_class.id,
      'class_name', target_class.name,
      'joined_at', p_joined_at
    )
  );

  insert into public.activity_logs (
    action_type,
    lesson_id,
    teacher_id,
    actor_user_id,
    details
  )
  values (
    'student_enrolled',
    null,
    target_class.teacher_id,
    actor_id,
    jsonb_build_object(
      'student_id', new_student.id,
      'student_code', new_student.student_code,
      'student_name', new_student.full_name,
      'class_id', target_class.id,
      'class_name', target_class.name,
      'joined_at', p_joined_at
    )
  );

  return jsonb_build_object(
    'success', true,
    'student_id', new_student.id,
    'class_id', target_class.id
  );
end;
$$;

create or replace function public.enroll_existing_student(
  p_student_id uuid,
  p_class_id uuid,
  p_joined_at date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  student_record public.students%rowtype;
  target_class public.classes%rowtype;
  active_class_name text;
begin
  if actor_id is null or not public.current_user_is_student_manager() then
    raise exception 'Only admin or staff users can enroll students.';
  end if;

  if p_joined_at is null then
    raise exception 'Enrollment start date is required.';
  end if;

  select * into student_record from public.students where id = p_student_id;
  if not found then
    raise exception 'Student was not found.';
  end if;

  select * into target_class from public.classes where id = p_class_id;
  if not found then
    raise exception 'Class/session was not found.';
  end if;

  if exists (
    select 1
    from public.class_students cs
    where cs.student_id = p_student_id
      and cs.class_id = p_class_id
      and cs.joined_at <= p_joined_at
      and (cs.left_at is null or cs.left_at >= p_joined_at)
  ) then
    raise exception 'The student already has an overlapping enrollment in this class/session.';
  end if;

  select c.name
    into active_class_name
  from public.class_students cs
  join public.classes c on c.id = cs.class_id
  where cs.student_id = p_student_id
    and cs.status = 'active'
    and (cs.left_at is null or cs.left_at >= p_joined_at)
  order by cs.joined_at desc
  limit 1;

  if active_class_name is not null then
    raise exception 'The student already has an active class/session (%). Use Transfer Class instead.', active_class_name;
  end if;

  insert into public.class_students (
    class_id,
    student_id,
    status,
    joined_at,
    left_at
  )
  values (
    p_class_id,
    p_student_id,
    'active',
    p_joined_at,
    null
  );

  insert into public.activity_logs (
    action_type,
    lesson_id,
    teacher_id,
    actor_user_id,
    details
  )
  values (
    'student_enrolled',
    null,
    target_class.teacher_id,
    actor_id,
    jsonb_build_object(
      'student_id', student_record.id,
      'student_code', student_record.student_code,
      'student_name', student_record.full_name,
      'class_id', target_class.id,
      'class_name', target_class.name,
      'joined_at', p_joined_at
    )
  );

  return jsonb_build_object('success', true, 'student_id', student_record.id, 'class_id', target_class.id);
end;
$$;

create or replace function public.update_student_details(
  p_student_id uuid,
  p_full_name text,
  p_student_code text,
  p_birth_year integer,
  p_guardian_phone text
)
returns public.students
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  normalized_phone text := public.normalize_guardian_phone(p_guardian_phone);
  updated_student public.students%rowtype;
begin
  if actor_id is null or not public.current_user_is_student_manager() then
    raise exception 'Only admin or staff users can update students.';
  end if;

  if length(trim(coalesce(p_full_name, ''))) = 0 then
    raise exception 'Full name is required.';
  end if;

  if length(trim(coalesce(p_student_code, ''))) = 0 then
    raise exception 'Student code is required.';
  end if;

  if exists (
    select 1
    from public.students s
    where s.student_code = trim(p_student_code)
      and s.id <> p_student_id
  ) then
    raise exception 'A different student already uses this student code.';
  end if;

  update public.students
  set
    full_name = regexp_replace(trim(p_full_name), '\s+', ' ', 'g'),
    student_code = trim(p_student_code),
    guardian_phone = normalized_phone,
    date_of_birth = case when p_birth_year is null then null else make_date(p_birth_year, 1, 1) end,
    updated_at = now()
  where id = p_student_id
  returning * into updated_student;

  if not found then
    raise exception 'Student was not found.';
  end if;

  insert into public.activity_logs (
    action_type,
    lesson_id,
    teacher_id,
    actor_user_id,
    details
  )
  values (
    'student_details_updated',
    null,
    null,
    actor_id,
    jsonb_build_object(
      'student_id', updated_student.id,
      'student_code', updated_student.student_code,
      'student_name', updated_student.full_name
    )
  );

  return updated_student;
end;
$$;

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
set search_path = public, pg_temp
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
  if actor_id is null or not public.current_user_is_student_manager() then
    raise exception 'Only admin or staff users can transfer students.';
  end if;

  if p_current_class_id = p_target_class_id then
    raise exception 'The new class/session must be different from the current class/session.';
  end if;

  if p_effective_date < date '2026-07-06' or p_effective_date > date '2026-08-12' then
    raise exception 'Effective date must be between 2026-07-06 and 2026-08-12.';
  end if;

  select * into student_record from public.students where id = p_student_id;
  if not found then
    raise exception 'Student was not found.';
  end if;

  select * into current_class from public.classes where id = p_current_class_id;
  if not found then
    raise exception 'Current class/session was not found.';
  end if;

  select * into target_class from public.classes where id = p_target_class_id;
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

  select array_agg(distinct l.lesson_date order by l.lesson_date)
    into conflict_dates
  from public.attendance a
  join public.lessons l on l.id = a.lesson_id
  where a.student_id = p_student_id
    and l.class_id = p_current_class_id
    and l.lesson_date >= p_effective_date;

  if coalesce(array_length(conflict_dates, 1), 0) > 0 then
    raise exception 'Transfer blocked. Attendance already exists in the current class on or after the effective date: %',
      array_to_string(conflict_dates, ', ');
  end if;

  select *
    into target_enrollment
  from public.class_students
  where class_id = p_target_class_id
    and student_id = p_student_id
  for update;

  if found and target_enrollment.joined_at <= p_effective_date and (target_enrollment.left_at is null or target_enrollment.left_at >= p_effective_date) then
    raise exception 'The student already has an overlapping assignment history in the target class/session.';
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

  select display_name into current_teacher_name from public.teachers where id = current_class.teacher_id;
  select display_name into target_teacher_name from public.teachers where id = target_class.teacher_id;

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

revoke all on function public.normalize_guardian_phone(text) from public;
revoke all on function public.normalize_student_name(text) from public;
revoke all on function public.current_user_is_student_manager() from public;
revoke all on function public.create_student_with_enrollment(text, text, integer, text, uuid, date, boolean) from public;
revoke all on function public.enroll_existing_student(uuid, uuid, date) from public;
revoke all on function public.update_student_details(uuid, text, text, integer, text) from public;
revoke all on function public.transfer_student_class_session(uuid, uuid, uuid, date, text) from public;

grant execute on function public.create_student_with_enrollment(text, text, integer, text, uuid, date, boolean) to authenticated;
grant execute on function public.enroll_existing_student(uuid, uuid, date) to authenticated;
grant execute on function public.update_student_details(uuid, text, text, integer, text) to authenticated;
grant execute on function public.transfer_student_class_session(uuid, uuid, uuid, date, text) to authenticated;

notify pgrst, 'reload schema';

commit;
