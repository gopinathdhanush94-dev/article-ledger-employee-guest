-- ============================================================
-- G-RECORDS SHOWROOM QUOTATION — EMPLOYEE WORKFLOW
-- Adds optional assignment + quotation completion tracking.
-- Quotation processing is webapp-only; no automatic email is sent.
-- Run after showroom_quotation_migration.sql
-- ============================================================

alter table public.showroom_orders
  add column if not exists assigned_employee_id uuid references auth.users(id) on delete set null;

alter table public.showroom_orders
  add column if not exists customer_notified_at timestamptz;

alter table public.showroom_orders
  add column if not exists quoted_at timestamptz;

create index if not exists idx_showroom_orders_assigned_employee
  on public.showroom_orders(assigned_employee_id, submitted_at desc);

-- Keep employee access broad for compatibility. The designated quotation user
-- can use this page to process requests; no email notification is performed.
drop policy if exists "Employees can view showroom orders" on public.showroom_orders;
create policy "Employees can view showroom orders" on public.showroom_orders
for select to authenticated using (public.is_active_employee());

drop policy if exists "Employees can update showroom orders" on public.showroom_orders;
create policy "Employees can update showroom orders" on public.showroom_orders
for update to authenticated
using (public.is_active_employee()) with check (public.is_active_employee());

notify pgrst, 'reload schema';
