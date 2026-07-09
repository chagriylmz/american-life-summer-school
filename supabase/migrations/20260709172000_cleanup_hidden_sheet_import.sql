-- Cleanup old hidden-sheet yazokulu import records only.
--
-- Run this before re-running:
-- sql/import_visible_yazokulu_approved.sql
--
-- This removes the previous hidden worksheet import for:
-- HEBA, RESUL, SAEIDE
--
-- It keeps the approved visible worksheet import records for:
-- HÜMEYRA, ONUR, SEVDE, KIMIA
--
-- Safe to re-run.

begin;

do $cleanup$
declare
  wrong_teacher_codes text[] := array['YAZ-HEBA', 'YAZ-RESUL', 'YAZ-SAEIDE'];
begin
  delete from public.lesson_notes ln
  using public.lessons l
  join public.teachers t on t.id = l.teacher_id
  where ln.lesson_id = l.id
    and t.employee_code = any(wrong_teacher_codes);

  delete from public.attendance a
  using public.lessons l
  join public.teachers t on t.id = l.teacher_id
  where a.lesson_id = l.id
    and t.employee_code = any(wrong_teacher_codes);

  delete from public.lessons l
  using public.teachers t
  where l.teacher_id = t.id
    and t.employee_code = any(wrong_teacher_codes);

  delete from public.class_students cs
  using public.classes c
  join public.teachers t on t.id = c.teacher_id
  where cs.class_id = c.id
    and t.employee_code = any(wrong_teacher_codes);

  delete from public.classes c
  using public.teachers t
  where c.teacher_id = t.id
    and t.employee_code = any(wrong_teacher_codes);

  delete from public.teachers
  where employee_code = any(wrong_teacher_codes);

  delete from public.students
  where student_code like 'YAZ-%'
    and student_code not like 'YAZ-VISIBLE-%';
end $cleanup$;

commit;
