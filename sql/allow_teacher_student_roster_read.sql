-- Allow teachers to read only students enrolled in their own classes.
--
-- This fixes the teacher attendance roster: class_students can be visible while
-- the nested public.students rows are still hidden by RLS.

begin;

alter table public.students enable row level security;

drop policy if exists "Teachers can read students in own summer school classes" on public.students;

create policy "Teachers can read students in own summer school classes"
on public.students for select
to authenticated
using (
  exists (
    select 1
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    join public.teachers t on t.id = c.teacher_id
    where cs.student_id = students.id
      and cs.status = 'active'
      and t.user_id = auth.uid()
      and t.is_active
  )
);

commit;
