-- Allow coordinators/staff to view and manage session tracking records.
--
-- This preserves teacher-owned policies and adds explicit admin/staff access for
-- coordinator dashboard details, late attendance entry, and lesson note review.

begin;

alter table public.attendance enable row level security;
alter table public.lesson_notes enable row level security;

drop policy if exists "Summer school staff can manage attendance tracking" on public.attendance;
drop policy if exists "Summer school staff can manage lesson note tracking" on public.lesson_notes;

create policy "Summer school staff can manage attendance tracking"
on public.attendance for all
to authenticated
using (public.current_user_has_role(array['admin', 'staff']::public.user_role[]))
with check (public.current_user_has_role(array['admin', 'staff']::public.user_role[]));

create policy "Summer school staff can manage lesson note tracking"
on public.lesson_notes for all
to authenticated
using (public.current_user_has_role(array['admin', 'staff']::public.user_role[]))
with check (public.current_user_has_role(array['admin', 'staff']::public.user_role[]));

commit;
