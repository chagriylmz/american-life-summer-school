-- Add explicit session lifecycle timestamps for teacher session flow.
-- Safe to run more than once.

begin;

alter table public.lessons
add column if not exists started_at timestamptz;

alter table public.lessons
add column if not exists finished_at timestamptz;

create index if not exists lessons_started_at_idx on public.lessons(started_at);
create index if not exists lessons_finished_at_idx on public.lessons(finished_at);

commit;
