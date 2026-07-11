-- Track authenticated user login/activity timestamps for admin visibility.
-- Run this once in Supabase SQL Editor.

begin;

alter table public.users
  add column if not exists last_login_at timestamptz,
  add column if not exists last_active_at timestamptz;

-- Existing RLS permits users to update their own profile row. Restrict direct
-- column privileges so activity timestamps can only be changed through RPCs.
revoke update on public.users from authenticated;
grant update (email, full_name, phone) on public.users to authenticated;

create or replace function public.record_own_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  update public.users
  set
    last_login_at = now(),
    last_active_at = now(),
    updated_at = now()
  where id = auth.uid()
    and is_active = true;
end;
$$;

create or replace function public.record_own_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  update public.users
  set
    last_active_at = now(),
    updated_at = now()
  where id = auth.uid()
    and is_active = true;
end;
$$;

revoke all on function public.record_own_login() from public;
revoke all on function public.record_own_activity() from public;

grant execute on function public.record_own_login() to authenticated;
grant execute on function public.record_own_activity() to authenticated;

commit;
