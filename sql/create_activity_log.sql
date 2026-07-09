-- Create audit/activity log for Summer School workflow actions.

begin;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  lesson_id uuid references public.lessons(id) on delete set null,
  teacher_id uuid references public.teachers(id) on delete set null,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_logs_action_type_check check (
    action_type in (
      'session_started',
      'attendance_updated',
      'lesson_note_saved',
      'session_finished',
      'late_entry_updated'
    )
  )
);

create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_lesson_id_idx on public.activity_logs(lesson_id);
create index if not exists activity_logs_teacher_id_idx on public.activity_logs(teacher_id);
create index if not exists activity_logs_actor_user_id_idx on public.activity_logs(actor_user_id);

alter table public.activity_logs enable row level security;

drop policy if exists "Summer school staff can read all activity logs" on public.activity_logs;
drop policy if exists "Summer school users can create own activity logs" on public.activity_logs;

create policy "Summer school staff can read all activity logs"
on public.activity_logs for select
to authenticated
using (public.current_user_has_role(array['admin', 'staff']::public.user_role[]));

create policy "Summer school users can create own activity logs"
on public.activity_logs for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and (
    public.current_user_has_role(array['admin', 'staff']::public.user_role[])
    or exists (
      select 1
      from public.teachers t
      where t.id = activity_logs.teacher_id
        and t.user_id = auth.uid()
        and t.is_active
        and (
          activity_logs.lesson_id is null
          or exists (
            select 1
            from public.lessons l
            where l.id = activity_logs.lesson_id
              and l.teacher_id = t.id
          )
        )
    )
  )
);

commit;
