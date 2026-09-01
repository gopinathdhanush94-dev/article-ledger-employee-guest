-- Repair existing guest accounts that were created before the profile trigger.
-- Safe to run more than once.
insert into public.user_profiles (user_id, full_name, email, employee_id, account_type, role, status)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(coalesce(u.email,''),'@',1), 'Guest'),
  u.email,
  null,
  'guest',
  'guest',
  'active'
from auth.users u
where coalesce(u.raw_user_meta_data->>'account_type', u.raw_user_meta_data->>'role', '') = 'guest'
on conflict (user_id) do update set
  account_type = 'guest',
  role = 'guest',
  status = 'active',
  email = excluded.email,
  full_name = coalesce(public.user_profiles.full_name, excluded.full_name),
  updated_at = now();

select pg_notify('pgrst', 'reload schema');
