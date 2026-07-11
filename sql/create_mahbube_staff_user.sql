-- Create the public profile for Mahbube Sehzade after creating the Supabase Auth user.
--
-- Important:
-- 1. First create Mahbube in Supabase Dashboard > Authentication > Users.
-- 2. Use a real email address and temporary password there.
-- 3. Copy the new Auth user UUID and email into the placeholders below.
-- 4. This file does not modify Cagri Yilmaz's account.
--
-- Current schema note:
-- - The app uses Supabase Auth email/password for login.
-- - public.users has no username or title column.
-- - Coordinator dashboard access is controlled by public.users.role = 'staff' or 'admin'.

begin;

-- Replace these placeholders before running:
--   00000000-0000-0000-0000-000000000000  -> Mahbube's new auth.users.id
--   mahbube@example.com                    -> Mahbube's real login email

insert into public.users (
  id,
  email,
  full_name,
  role,
  is_active
)
values (
  '00000000-0000-0000-0000-000000000000',
  'mahbube@example.com',
  U&'Mahbube \015Eehzade',
  'staff',
  true
)
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = excluded.is_active;

commit;

-- Verify after running:
-- select id, email, full_name, role, is_active
-- from public.users
-- where full_name = U&'Mahbube \015Eehzade';
