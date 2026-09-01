-- Run once in the Employee/Guest Supabase project after showroom_schema.sql.
-- Adds public-safe MRP to showroom items and creates the guest showroom order workflow.

alter table public.showroom_items add column if not exists mrp numeric;

update public.showroom_items s
set mrp = p.mrp,
    updated_at = now()
from public.products p
where s.source_type = 'product'
  and s.source_id = p.id;

create table if not exists public.showroom_order_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique default ('SR-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  created_by uuid not null references auth.users(id) on delete restrict,
  lead_period text,
  required_date date,
  comments text,
  total_mrp numeric(14,2) not null default 0,
  status text not null default 'submitted' check (status in ('submitted','processing','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.showroom_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.showroom_order_requests(id) on delete cascade,
  showroom_item_id uuid not null references public.showroom_items(id) on delete restrict,
  product_name text not null,
  ean text,
  model text,
  mrp numeric(14,2) not null default 0,
  quantity integer not null check (quantity > 0),
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_showroom_order_requests_created_by on public.showroom_order_requests(created_by);
create index if not exists idx_showroom_order_requests_created_at on public.showroom_order_requests(created_at desc);
create index if not exists idx_showroom_order_items_order on public.showroom_order_items(order_id);

alter table public.showroom_order_requests enable row level security;
alter table public.showroom_order_items enable row level security;

drop policy if exists "Guests can create showroom orders" on public.showroom_order_requests;
create policy "Guests can create showroom orders" on public.showroom_order_requests
for insert to authenticated with check (created_by = auth.uid() and public.current_account_type() = 'guest' and public.current_app_role() = 'guest');

drop policy if exists "Guests can create showroom order items" on public.showroom_order_items;
create policy "Guests can create showroom order items" on public.showroom_order_items
for insert to authenticated with check (exists (select 1 from public.showroom_order_requests o where o.id = order_id and o.created_by = auth.uid()));

drop policy if exists "Guests can delete their showroom orders" on public.showroom_order_requests;
create policy "Guests can delete their showroom orders" on public.showroom_order_requests
for delete to authenticated using (created_by = auth.uid() and status = 'submitted');

drop policy if exists "Guests can view their showroom orders" on public.showroom_order_requests;
create policy "Guests can view their showroom orders" on public.showroom_order_requests
for select to authenticated using (created_by = auth.uid());

drop policy if exists "Guests can view their showroom order items" on public.showroom_order_items;
create policy "Guests can view their showroom order items" on public.showroom_order_items
for select to authenticated using (exists (select 1 from public.showroom_order_requests o where o.id = order_id and o.created_by = auth.uid()));

drop policy if exists "Employees can view showroom orders" on public.showroom_order_requests;
create policy "Employees can view showroom orders" on public.showroom_order_requests
for select to authenticated using (public.is_active_employee());

drop policy if exists "Employees can view showroom order items" on public.showroom_order_items;
create policy "Employees can view showroom order items" on public.showroom_order_items
for select to authenticated using (public.is_active_employee());

create or replace function public.set_showroom_order_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_showroom_order_requests_updated_at on public.showroom_order_requests;
create trigger trg_showroom_order_requests_updated_at before update on public.showroom_order_requests
for each row execute function public.set_showroom_order_updated_at();

notify pgrst, 'reload schema';
