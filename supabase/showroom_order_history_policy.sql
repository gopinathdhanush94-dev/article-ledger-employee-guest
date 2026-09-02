-- G-RECORDS Showroom: guest order history access
-- Idempotent policy guard for the guest order-history UI.

alter table public.showroom_orders enable row level security;
alter table public.showroom_order_items enable row level security;

drop policy if exists "Guests can view their own showroom orders" on public.showroom_orders;
create policy "Guests can view their own showroom orders"
on public.showroom_orders
for select
to authenticated
using (customer_user_id = auth.uid());

drop policy if exists "Guests can view their own order items" on public.showroom_order_items;
create policy "Guests can view their own order items"
on public.showroom_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.showroom_orders o
    where o.id = showroom_order_items.order_id
      and o.customer_user_id = auth.uid()
  )
);

create index if not exists idx_showroom_orders_customer_history
  on public.showroom_orders(customer_user_id, submitted_at desc);

notify pgrst, 'reload schema';
