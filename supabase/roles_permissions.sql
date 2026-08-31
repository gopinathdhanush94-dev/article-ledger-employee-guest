-- ============================================================
-- Article Ledger — Application Roles & Permissions
-- Run once in Supabase SQL Editor on the Employee/Guest database.
-- ============================================================

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  employee_id text,
  account_type text not null default 'employee' check (account_type in ('employee','guest')),
  role text not null default 'viewer' check (role in ('super_admin','admin','editor','viewer','guest')),
  status text not null default 'active' check (status in ('active','pending','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_account_type on public.user_profiles(account_type);
create index if not exists idx_user_profiles_role on public.user_profiles(role);
create index if not exists idx_user_profiles_status on public.user_profiles(status);

-- Existing auth users are bootstrapped safely as employee/viewer unless their old
-- metadata explicitly says role=guest. This prevents existing internal users from
-- losing access when the new RLS rules are enabled.
insert into public.user_profiles (user_id, full_name, email, employee_id, account_type, role, status)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(coalesce(u.email,''),'@',1), 'User'),
  u.email,
  nullif(u.raw_user_meta_data->>'employee_id',''),
  case when coalesce(u.raw_user_meta_data->>'role','') = 'guest' then 'guest' else 'employee' end,
  case when coalesce(u.raw_user_meta_data->>'role','') = 'guest' then 'guest' else 'viewer' end,
  'active'
from auth.users u
on conflict (user_id) do nothing;

-- New signups: guest = immediately active guest; employee = pending viewer.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_type text := coalesce(new.raw_user_meta_data->>'account_type', new.raw_user_meta_data->>'role', 'employee');
  is_guest boolean := requested_type = 'guest';
begin
  insert into public.user_profiles (user_id, full_name, email, employee_id, account_type, role, status)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    new.email,
    nullif(trim(new.raw_user_meta_data->>'employee_id'), ''),
    case when is_guest then 'guest' else 'employee' end,
    case when is_guest then 'guest' else 'viewer' end,
    case when is_guest then 'active' else 'pending' end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- Keep profile timestamps fresh.
create or replace function public.set_user_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_user_profile_updated_at();

-- Protected helpers used by RLS and the application.
create or replace function public.current_user_profile()
returns public.user_profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.* from public.user_profiles p where p.user_id = auth.uid();
$$;

create or replace function public.current_account_type()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select account_type from public.current_user_profile();
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.current_user_profile();
$$;

create or replace function public.is_active_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
      and account_type = 'employee'
      and status = 'active'
  );
$$;

create or replace function public.has_any_app_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = any(required_roles), false);
$$;

-- user_profiles RLS
alter table public.user_profiles enable row level security;
drop policy if exists "Users can view own profile" on public.user_profiles;
create policy "Users can view own profile" on public.user_profiles
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Admins can view all profiles" on public.user_profiles;
create policy "Admins can view all profiles" on public.user_profiles
for select to authenticated using (public.has_any_app_role(array['admin','super_admin']));

drop policy if exists "Admins can manage profiles" on public.user_profiles;
create policy "Admins can manage profiles" on public.user_profiles
for update to authenticated
using (
  public.has_any_app_role(array['admin','super_admin'])
  and user_id <> auth.uid()
)
with check (
  public.has_any_app_role(array['admin','super_admin'])
  and (
    public.current_app_role() = 'super_admin'
    or role not in ('super_admin','admin')
  )
);

-- Employees only: internal product reads/writes.
alter table public.products enable row level security;
drop policy if exists "Public read access" on public.products;
drop policy if exists "Authenticated users can insert" on public.products;
drop policy if exists "Authenticated users can update" on public.products;
drop policy if exists "Authenticated users can delete" on public.products;

drop policy if exists "Active employees can read products" on public.products;
create policy "Active employees can read products" on public.products
for select to authenticated using (public.is_active_employee());

drop policy if exists "Editors can insert products" on public.products;
create policy "Editors can insert products" on public.products
for insert to authenticated
with check (public.has_any_app_role(array['editor','admin','super_admin']) and public.is_active_employee());

drop policy if exists "Editors can update products" on public.products;
create policy "Editors can update products" on public.products
for update to authenticated
using (public.has_any_app_role(array['editor','admin','super_admin']) and public.is_active_employee())
with check (public.has_any_app_role(array['editor','admin','super_admin']) and public.is_active_employee());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products" on public.products
for delete to authenticated
using (public.has_any_app_role(array['admin','super_admin']) and public.is_active_employee());

-- Employees only: internal garments.
alter table public.garments enable row level security;
drop policy if exists "Public read access" on public.garments;
drop policy if exists "Authenticated users can insert" on public.garments;
drop policy if exists "Authenticated users can update" on public.garments;
drop policy if exists "Authenticated users can delete" on public.garments;

drop policy if exists "Active employees can read garments" on public.garments;
create policy "Active employees can read garments" on public.garments
for select to authenticated using (public.is_active_employee());

drop policy if exists "Editors can insert garments" on public.garments;
create policy "Editors can insert garments" on public.garments
for insert to authenticated
with check (public.has_any_app_role(array['editor','admin','super_admin']) and public.is_active_employee());

drop policy if exists "Editors can update garments" on public.garments;
create policy "Editors can update garments" on public.garments
for update to authenticated
using (public.has_any_app_role(array['editor','admin','super_admin']) and public.is_active_employee())
with check (public.has_any_app_role(array['editor','admin','super_admin']) and public.is_active_employee());

drop policy if exists "Admins can delete garments" on public.garments;
create policy "Admins can delete garments" on public.garments
for delete to authenticated
using (public.has_any_app_role(array['admin','super_admin']) and public.is_active_employee());

-- ============================================================
-- FIRST ADMIN BOOTSTRAP
-- After creating your first employee account, run this manually ONCE:
--
-- update public.user_profiles
-- set role='super_admin', status='active'
-- where email='YOUR-EMPLOYEE-EMAIL' and account_type='employee';
--
-- Do not expose this as a client-side function.
-- ============================================================
