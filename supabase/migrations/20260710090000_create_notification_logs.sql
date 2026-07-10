-- Create parent notification logging infrastructure.
--
-- This stores pending notification records only. It does not send SMS and does
-- not change attendance, lesson, teacher, class, or student records.

begin;

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_id uuid references public.attendance(id) on delete set null,
  notification_type text not null,
  phone text not null,
  message text not null,
  status text not null default 'pending',
  provider text,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint notification_logs_notification_type_check check (
    notification_type in ('late', 'absent')
  ),
  constraint notification_logs_status_check check (
    status in ('pending', 'sent', 'failed')
  ),
  constraint notification_logs_phone_not_blank check (length(trim(phone)) > 0),
  constraint notification_logs_message_not_blank check (length(trim(message)) > 0)
);

create unique index if not exists notification_logs_student_attendance_type_uidx
on public.notification_logs(student_id, attendance_id, notification_type);

create index if not exists notification_logs_student_id_idx on public.notification_logs(student_id);
create index if not exists notification_logs_attendance_id_idx on public.notification_logs(attendance_id);
create index if not exists notification_logs_status_idx on public.notification_logs(status);
create index if not exists notification_logs_created_at_idx on public.notification_logs(created_at desc);

alter table public.notification_logs enable row level security;

drop policy if exists "Summer school staff can manage notification logs" on public.notification_logs;
drop policy if exists "Teachers can create notification logs for own attendance" on public.notification_logs;

create policy "Summer school staff can manage notification logs"
on public.notification_logs for all
to authenticated
using (public.current_user_has_role(array['admin', 'staff']::public.user_role[]))
with check (public.current_user_has_role(array['admin', 'staff']::public.user_role[]));

create policy "Teachers can create notification logs for own attendance"
on public.notification_logs for insert
to authenticated
with check (
  status = 'pending'
  and notification_type in ('late', 'absent')
  and attendance_id is not null
  and exists (
    select 1
    from public.attendance a
    join public.lessons l on l.id = a.lesson_id and l.class_id = a.class_id
    join public.teachers t on t.id = l.teacher_id
    where a.id = notification_logs.attendance_id
      and a.student_id = notification_logs.student_id
      and t.user_id = auth.uid()
      and t.is_active
  )
);

commit;
