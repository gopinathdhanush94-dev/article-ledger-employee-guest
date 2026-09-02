-- ============================================================
-- Article Ledger — Roles, tab access and user assignment
-- Run after roles_permissions.sql and existing showroom/quotation migrations.
-- Admin and Super Admin can assign roles to other users.
-- Admin cannot promote anyone to Super Admin; only Super Admin can do that.
-- ============================================================

-- 1) Supported application roles.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('super_admin','admin','quotation_manager','guest_manager','editor','viewer','guest'));

-- Existing employees stay valid. Guest accounts remain role=guest.
update public.user_profiles
set role = 'guest'
where account_type = 'guest' and role <> 'guest';

-- 2) Central role helpers used by RLS.
create or replace function public.can_manage_users()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = any(array['admin','super_admin']), false)
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid()
        and account_type = 'employee'
        and status = 'active'
    );
$$;

create or replace function public.can_manage_user_target(target_user_id uuid, target_role text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_manage_users()
    and target_user_id <> auth.uid()
    and (
      public.current_app_role() = 'super_admin'
      or (
        public.current_app_role() = 'admin'
        and coalesce(target_role, '') <> 'super_admin'
      )
    );
$$;

-- 3) user_profiles policies: Admin + Super Admin can view and assign roles/status.
drop policy if exists "Users can view own profile" on public.user_profiles;
drop policy if exists "Admins can view all profiles" on public.user_profiles;
drop policy if exists "Admins can manage profiles" on public.user_profiles;
drop policy if exists "Admins can manage user profiles" on public.user_profiles;

create policy "Users can view own profile"
on public.user_profiles for select to authenticated
using (user_id = auth.uid());

create policy "Admins can view all profiles"
on public.user_profiles for select to authenticated
using (public.can_manage_users());

create policy "Admins can manage user profiles"
on public.user_profiles for update to authenticated
using (public.can_manage_user_target(user_id, role))
with check (
  public.can_manage_users()
  and user_id <> auth.uid()
  and (
    public.current_app_role() = 'super_admin'
    or role <> 'super_admin'
  )
  and (
    account_type = 'guest'
    or role in ('super_admin','admin','quotation_manager','guest_manager','editor','viewer')
  )
);

-- 4) Showroom management follows the requested role matrix.
drop policy if exists "Editors can update showroom items" on public.showroom_items;
drop policy if exists "Editors can create showroom items" on public.showroom_items;
drop policy if exists "Admins can delete showroom items" on public.showroom_items;
drop policy if exists "Showroom managers can update showroom items" on public.showroom_items;
drop policy if exists "Showroom managers can create showroom items" on public.showroom_items;
drop policy if exists "Showroom managers can delete showroom items" on public.showroom_items;

create policy "Showroom managers can update showroom items"
on public.showroom_items for update to authenticated
using (
  public.current_app_role() = any(array['quotation_manager','guest_manager','admin','super_admin'])
  and public.is_active_employee()
)
with check (
  public.current_app_role() = any(array['quotation_manager','guest_manager','admin','super_admin'])
  and public.is_active_employee()
);

-- No role gets a delete/remove operation from Showroom.

-- 5) Keep quotation authorization aligned with the same roles.
create or replace function public.can_manage_showroom_quotations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = any(array['quotation_manager','admin','super_admin']), false)
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid()
        and account_type = 'employee'
        and status = 'active'
    );
$$;

-- 6) Explicit product/garment rights according to the role matrix.
-- Viewer/Quotation Manager/Guest Manager have read access through the existing
-- active-employee policies. Only Editor/Admin/Super Admin can write catalogue data.

notify pgrst, 'reload schema';
