-- Language school production schema for Supabase/Postgres.
-- Run with the Supabase CLI or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.user_role as enum ('admin', 'staff', 'teacher', 'student');
create type public.language_level as enum ('beginner', 'elementary', 'pre_intermediate', 'intermediate', 'upper_intermediate', 'advanced');
create type public.class_status as enum ('draft', 'scheduled', 'active', 'completed', 'cancelled');
create type public.enrollment_status as enum ('active', 'paused', 'completed', 'dropped');
create type public.lesson_status as enum ('scheduled', 'completed', 'cancelled');
create type public.attendance_status as enum ('present', 'late', 'absent', 'excused');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  full_name text not null,
  phone text,
  role public.user_role not null default 'student',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_full_name_not_blank check (length(trim(full_name)) > 0)
);

create or replace function public.current_user_has_role(allowed_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = any(allowed_roles)
      and u.is_active
  );
$$;

revoke all on function public.current_user_has_role(public.user_role[]) from public;
grant execute on function public.current_user_has_role(public.user_role[]) to authenticated;

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users(id) on delete set null,
  employee_code text unique,
  display_name text not null,
  email citext unique,
  phone text,
  bio text,
  languages text[] not null default '{}',
  hourly_rate numeric(10, 2),
  is_active boolean not null default true,
  hired_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teachers_display_name_not_blank check (length(trim(display_name)) > 0),
  constraint teachers_hourly_rate_non_negative check (hourly_rate is null or hourly_rate >= 0)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users(id) on delete set null,
  student_code text unique,
  full_name text not null,
  email citext,
  phone text,
  guardian_name text,
  guardian_phone text,
  date_of_birth date,
  native_language text,
  target_language text not null,
  current_level public.language_level not null default 'beginner',
  enrollment_date date not null default current_date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_full_name_not_blank check (length(trim(full_name)) > 0),
  constraint students_target_language_not_blank check (length(trim(target_language)) > 0)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  name text not null,
  language text not null,
  level public.language_level not null,
  status public.class_status not null default 'draft',
  capacity integer not null default 12,
  start_date date not null,
  end_date date,
  schedule jsonb not null default '[]'::jsonb,
  location text,
  meeting_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_name_not_blank check (length(trim(name)) > 0),
  constraint classes_language_not_blank check (length(trim(language)) > 0),
  constraint classes_capacity_positive check (capacity > 0),
  constraint classes_date_order check (end_date is null or end_date >= start_date),
  constraint classes_schedule_is_array check (jsonb_typeof(schedule) = 'array')
);

create table public.class_students (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.enrollment_status not null default 'active',
  joined_at date not null default current_date,
  left_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (class_id, student_id),
  constraint class_students_date_order check (left_at is null or left_at >= joined_at)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete set null,
  lesson_date date not null,
  starts_at time not null,
  ends_at time not null,
  title text not null,
  objectives text,
  materials text,
  homework text,
  status public.lesson_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lessons_title_not_blank check (length(trim(title)) > 0),
  constraint lessons_time_order check (ends_at > starts_at),
  unique (class_id, lesson_date, starts_at),
  unique (id, class_id)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null,
  class_id uuid not null,
  student_id uuid not null,
  status public.attendance_status not null default 'present',
  arrived_at timestamptz,
  notes text,
  recorded_by uuid references public.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, student_id),
  foreign key (lesson_id, class_id) references public.lessons(id, class_id) on delete cascade,
  foreign key (class_id, student_id) references public.class_students(class_id, student_id) on delete cascade
);

create table public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  title text,
  body text not null,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_notes_body_not_blank check (length(trim(body)) > 0)
);

create index users_role_idx on public.users(role);
create index teachers_user_id_idx on public.teachers(user_id);
create index teachers_is_active_idx on public.teachers(is_active);
create index students_user_id_idx on public.students(user_id);
create index students_is_active_idx on public.students(is_active);
create index students_current_level_idx on public.students(current_level);
create index classes_teacher_id_idx on public.classes(teacher_id);
create index classes_status_idx on public.classes(status);
create index classes_language_level_idx on public.classes(language, level);
create index class_students_student_id_idx on public.class_students(student_id);
create index class_students_status_idx on public.class_students(status);
create index lessons_class_id_lesson_date_idx on public.lessons(class_id, lesson_date);
create index lessons_teacher_id_idx on public.lessons(teacher_id);
create index lessons_status_idx on public.lessons(status);
create index attendance_student_id_idx on public.attendance(student_id);
create index attendance_status_idx on public.attendance(status);
create index lesson_notes_lesson_id_idx on public.lesson_notes(lesson_id);
create index lesson_notes_author_id_idx on public.lesson_notes(author_id);

create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger set_teachers_updated_at
before update on public.teachers
for each row execute function public.set_updated_at();

create trigger set_students_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create trigger set_classes_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

create trigger set_class_students_updated_at
before update on public.class_students
for each row execute function public.set_updated_at();

create trigger set_lessons_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

create trigger set_attendance_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();

create trigger set_lesson_notes_updated_at
before update on public.lesson_notes
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.classes enable row level security;
alter table public.class_students enable row level security;
alter table public.lessons enable row level security;
alter table public.attendance enable row level security;
alter table public.lesson_notes enable row level security;

create policy "Users can read their own profile"
on public.users for select
to authenticated
using (id = auth.uid());

create policy "Admins and staff can read all users"
on public.users for select
to authenticated
using (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
);

create policy "Users can update their own profile"
on public.users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Admins and staff can manage teachers"
on public.teachers for all
to authenticated
using (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
)
with check (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
);

create policy "Teachers can read their own teacher profile"
on public.teachers for select
to authenticated
using (user_id = auth.uid());

create policy "Admins and staff can manage students"
on public.students for all
to authenticated
using (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
)
with check (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
);

create policy "Students can read their own student profile"
on public.students for select
to authenticated
using (user_id = auth.uid());

create policy "School staff can manage classes"
on public.classes for all
to authenticated
using (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
)
with check (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
);

create policy "Teachers can read their own classes"
on public.classes for select
to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.id = classes.teacher_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

create policy "Students can read their enrolled classes"
on public.classes for select
to authenticated
using (
  exists (
    select 1
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = classes.id
      and s.user_id = auth.uid()
      and cs.status = 'active'
  )
);

create policy "School staff can manage class enrollments"
on public.class_students for all
to authenticated
using (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
)
with check (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
);

create policy "Teachers can read enrollments for their classes"
on public.class_students for select
to authenticated
using (
  exists (
    select 1
    from public.classes c
    join public.teachers t on t.id = c.teacher_id
    where c.id = class_students.class_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

create policy "Students can read their own enrollments"
on public.class_students for select
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = class_students.student_id
      and s.user_id = auth.uid()
  )
);

create policy "School staff can manage lessons"
on public.lessons for all
to authenticated
using (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
)
with check (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
);

create policy "Teachers can manage lessons for their classes"
on public.lessons for all
to authenticated
using (
  exists (
    select 1
    from public.classes c
    join public.teachers t on t.id = c.teacher_id
    where c.id = lessons.class_id
      and t.user_id = auth.uid()
      and t.is_active
  )
)
with check (
  exists (
    select 1
    from public.classes c
    join public.teachers t on t.id = c.teacher_id
    where c.id = lessons.class_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

create policy "Students can read lessons for enrolled classes"
on public.lessons for select
to authenticated
using (
  exists (
    select 1
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = lessons.class_id
      and s.user_id = auth.uid()
      and cs.status = 'active'
  )
);

create policy "School staff can manage attendance"
on public.attendance for all
to authenticated
using (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
)
with check (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
);

create policy "Teachers can manage attendance for their classes"
on public.attendance for all
to authenticated
using (
  exists (
    select 1
    from public.classes c
    join public.teachers t on t.id = c.teacher_id
    where c.id = attendance.class_id
      and t.user_id = auth.uid()
      and t.is_active
  )
)
with check (
  exists (
    select 1
    from public.classes c
    join public.teachers t on t.id = c.teacher_id
    where c.id = attendance.class_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

create policy "Students can read their own attendance"
on public.attendance for select
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = attendance.student_id
      and s.user_id = auth.uid()
  )
);

create policy "School staff can manage lesson notes"
on public.lesson_notes for all
to authenticated
using (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
)
with check (
  public.current_user_has_role(array['admin', 'staff']::public.user_role[])
);

create policy "Teachers can manage notes for their lessons"
on public.lesson_notes for all
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    join public.classes c on c.id = l.class_id
    join public.teachers t on t.id = c.teacher_id
    where l.id = lesson_notes.lesson_id
      and t.user_id = auth.uid()
      and t.is_active
  )
)
with check (
  exists (
    select 1
    from public.lessons l
    join public.classes c on c.id = l.class_id
    join public.teachers t on t.id = c.teacher_id
    where l.id = lesson_notes.lesson_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

create policy "Students can read non-private notes for their lessons"
on public.lesson_notes for select
to authenticated
using (
  is_private = false
  and exists (
    select 1
    from public.lessons l
    join public.class_students cs on cs.class_id = l.class_id
    join public.students s on s.id = cs.student_id
    where l.id = lesson_notes.lesson_id
      and s.user_id = auth.uid()
      and cs.status = 'active'
  )
);

