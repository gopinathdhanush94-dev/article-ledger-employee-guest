-- Premium Selection is intentionally separate from Handpicked Featured products.
-- Run this migration once in Supabase SQL Editor.

alter table if exists public.showroom_items
  add column if not exists premium_selected boolean not null default false,
  add column if not exists premium_rank integer;

create index if not exists idx_showroom_premium_selection
  on public.showroom_items(premium_selected, premium_rank);

-- Existing Featured products are left untouched. Premium starts empty so no
-- existing product is unexpectedly duplicated on the Guest Showroom.
select pg_notify('pgrst', 'reload schema');
