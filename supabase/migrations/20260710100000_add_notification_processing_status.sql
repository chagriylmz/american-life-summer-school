-- Add safe processing support for parent notification delivery.
--
-- This does not send SMS. It only extends notification_logs so a secure
-- backend processor can atomically claim pending records before attempting
-- delivery.

begin;

alter table public.notification_logs
drop constraint if exists notification_logs_status_check;

alter table public.notification_logs
add constraint notification_logs_status_check check (
  status in ('pending', 'processing', 'sent', 'failed')
);

alter table public.notification_logs
add column if not exists processing_started_at timestamptz;

create index if not exists notification_logs_processing_started_at_idx
on public.notification_logs(processing_started_at)
where status = 'processing';

create or replace function public.claim_pending_notification_logs(batch_size integer default 10)
returns setof public.notification_logs
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select id
    from public.notification_logs
    where (
        status = 'pending'
        or (
          status = 'processing'
          and processing_started_at < now() - interval '15 minutes'
        )
      )
      and length(trim(phone)) > 0
      and length(trim(message)) > 0
    order by created_at asc
    for update skip locked
    limit least(greatest(coalesce(batch_size, 10), 1), 50)
  )
  update public.notification_logs nl
  set
    status = 'processing',
    processing_started_at = now(),
    provider = null,
    provider_message_id = null,
    error_message = null
  from candidates
  where nl.id = candidates.id
  returning nl.*;
$$;

revoke all on function public.claim_pending_notification_logs(integer) from public;
revoke all on function public.claim_pending_notification_logs(integer) from anon;
revoke all on function public.claim_pending_notification_logs(integer) from authenticated;
grant execute on function public.claim_pending_notification_logs(integer) to service_role;

commit;
