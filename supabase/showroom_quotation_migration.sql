-- Showroom quotation-request workflow.
-- Customer never receives MRP/selling-price data at request stage.
create table if not exists public.showroom_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  customer_email text not null,
  customer_name text,
  status text not null default 'quotation_requested' check (status in ('quotation_requested','pricing_in_progress','quoted','cancelled','completed')),
  comments text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.showroom_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.showroom_orders(id) on delete cascade,
  showroom_item_id uuid references public.showroom_items(id) on delete set null,
  product_name text not null,
  ean text,
  model text,
  category text,
  quantity integer not null default 1 check (quantity > 0),
  required_date date not null,
  requested_image_url text,
  availability text,
  quoted_unit_price numeric,
  account_note text,
  quoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility for installations where showroom_order_items was created by an older migration.
alter table public.showroom_order_items add column if not exists model text;
alter table public.showroom_order_items add column if not exists category text;
alter table public.showroom_order_items add column if not exists requested_image_url text;
alter table public.showroom_order_items add column if not exists availability text;
alter table public.showroom_order_items add column if not exists quoted_unit_price numeric;
alter table public.showroom_order_items add column if not exists account_note text;
alter table public.showroom_order_items add column if not exists quoted_at timestamptz;

-- Refresh PostgREST's schema cache immediately after the compatibility changes.
select pg_notify('pgrst', 'reload schema');

create index if not exists idx_showroom_orders_customer on public.showroom_orders(customer_user_id, submitted_at desc);
create index if not exists idx_showroom_orders_status on public.showroom_orders(status);
create index if not exists idx_showroom_order_items_order on public.showroom_order_items(order_id);

create or replace function public.set_showroom_order_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_showroom_orders_updated_at on public.showroom_orders;
create trigger trg_showroom_orders_updated_at before update on public.showroom_orders for each row execute function public.set_showroom_order_updated_at();
drop trigger if exists trg_showroom_order_items_updated_at on public.showroom_order_items;
create trigger trg_showroom_order_items_updated_at before update on public.showroom_order_items for each row execute function public.set_showroom_order_updated_at();

alter table public.showroom_orders enable row level security;
alter table public.showroom_order_items enable row level security;

drop policy if exists "Guests can create their own showroom orders" on public.showroom_orders;
create policy "Guests can create their own showroom orders" on public.showroom_orders for insert to authenticated
with check (customer_user_id = auth.uid() and customer_email = coalesce((select email from public.user_profiles where user_id = auth.uid()), ''));

drop policy if exists "Guests can view their own showroom orders" on public.showroom_orders;
create policy "Guests can view their own showroom orders" on public.showroom_orders for select to authenticated
using (customer_user_id = auth.uid());

drop policy if exists "Employees can view showroom orders" on public.showroom_orders;
create policy "Employees can view showroom orders" on public.showroom_orders for select to authenticated
using (public.is_active_employee());

drop policy if exists "Employees can update showroom orders" on public.showroom_orders;
create policy "Employees can update showroom orders" on public.showroom_orders for update to authenticated
using (public.is_active_employee()) with check (public.is_active_employee());

drop policy if exists "Guests can create items for their own orders" on public.showroom_order_items;
create policy "Guests can create items for their own orders" on public.showroom_order_items for insert to authenticated
with check (exists (select 1 from public.showroom_orders o where o.id = order_id and o.customer_user_id = auth.uid()));

drop policy if exists "Guests can view their own order items" on public.showroom_order_items;
create policy "Guests can view their own order items" on public.showroom_order_items for select to authenticated
using (exists (select 1 from public.showroom_orders o where o.id = order_id and o.customer_user_id = auth.uid()));

drop policy if exists "Employees can view showroom order items" on public.showroom_order_items;
create policy "Employees can view showroom order items" on public.showroom_order_items for select to authenticated
using (public.is_active_employee());

drop policy if exists "Employees can update showroom order items" on public.showroom_order_items;
create policy "Employees can update showroom order items" on public.showroom_order_items for update to authenticated
using (public.is_active_employee()) with check (public.is_active_employee());

-- Account users can later fill these two fields. They are intentionally NULL
-- until pricing/availability has been confirmed.
