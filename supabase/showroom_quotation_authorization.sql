-- ============================================================
-- G-RECORDS SHOWROOM QUOTATION — AUTHORIZATION + DELETE
-- Run after roles_permissions.sql and showroom_quotation_employee_workflow.sql.
-- Quotation processing is restricted to quotation_manager/admin/super_admin.
-- No automatic email is used.
-- ============================================================

-- Add a dedicated role for the designated quotation user.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('super_admin','admin','quotation_manager','editor','viewer','guest'));

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

-- Remove the broad employee quotation policies created by earlier migrations.
drop policy if exists "Employees can view showroom orders" on public.showroom_orders;
drop policy if exists "Employees can update showroom orders" on public.showroom_orders;
drop policy if exists "Employees can delete showroom orders" on public.showroom_orders;

create policy "Quotation managers can view showroom orders"
on public.showroom_orders for select to authenticated
using (public.can_manage_showroom_quotations() or customer_user_id = auth.uid());

create policy "Quotation managers can update showroom orders"
on public.showroom_orders for update to authenticated
using (public.can_manage_showroom_quotations())
with check (public.can_manage_showroom_quotations());

create policy "Quotation managers can delete showroom orders"
on public.showroom_orders for delete to authenticated
using (public.can_manage_showroom_quotations());

-- Remove broad employee item policies and replace them with quotation authorization.
drop policy if exists "Employees can view showroom order items" on public.showroom_order_items;
drop policy if exists "Employees can update showroom order items" on public.showroom_order_items;
drop policy if exists "Quotation managers can view showroom order items" on public.showroom_order_items;
drop policy if exists "Quotation managers can update showroom order items" on public.showroom_order_items;

create policy "Quotation managers can view showroom order items"
on public.showroom_order_items for select to authenticated
using (
  public.can_manage_showroom_quotations()
  or exists (
    select 1 from public.showroom_orders o
    where o.id = order_id and o.customer_user_id = auth.uid()
  )
);

create policy "Quotation managers can update showroom order items"
on public.showroom_order_items for update to authenticated
using (public.can_manage_showroom_quotations())
with check (public.can_manage_showroom_quotations());

-- showroom_order_items.order_id is ON DELETE CASCADE, so deleting a quotation
-- automatically deletes its selected article rows.

notify pgrst, 'reload schema';
