-- Article Ledger — Showroom SKU details migration
-- Run ONCE in the Employee/Guest Supabase project.
-- Adds public-safe SKU dimensions/weights, backfills existing product rows,
-- and keeps these fields synchronized when source product SKU data changes.

alter table public.showroom_items
  add column if not exists mrp numeric,
  add column if not exists sku_l numeric,
  add column if not exists sku_w numeric,
  add column if not exists sku_h numeric,
  add column if not exists sku_dim_unit text,
  add column if not exists sku_nw numeric,
  add column if not exists sku_gw numeric,
  add column if not exists sku_wt_unit text;

update public.showroom_items s
set
  mrp = p.mrp,
  sku_l = p.sku_l, sku_w = p.sku_w, sku_h = p.sku_h,
  sku_dim_unit = p.sku_dim_unit, sku_nw = p.sku_nw, sku_gw = p.sku_gw,
  sku_wt_unit = p.sku_wt_unit,
  dimensions = case
    when p.sku_l is not null and p.sku_w is not null and p.sku_h is not null
      then concat(p.sku_l, ' × ', p.sku_w, ' × ', p.sku_h, coalesce(' ' || nullif(p.sku_dim_unit,''), ''))
    else null
  end,
  updated_at = now()
from public.products p
where s.source_type = 'product'
  and s.source_id = p.id;

create or replace function public.sync_product_showroom_sku()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.showroom_items
  set
    mrp = new.mrp,
    sku_l = new.sku_l, sku_w = new.sku_w, sku_h = new.sku_h,
    sku_dim_unit = new.sku_dim_unit, sku_nw = new.sku_nw, sku_gw = new.sku_gw,
    sku_wt_unit = new.sku_wt_unit,
    dimensions = case
      when new.sku_l is not null and new.sku_w is not null and new.sku_h is not null
        then concat(new.sku_l, ' × ', new.sku_w, ' × ', new.sku_h, coalesce(' ' || nullif(new.sku_dim_unit, ''), ''))
      else null
    end,
    updated_at = now()
  where source_type = 'product' and source_id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_sync_product_showroom_sku on public.products;
create trigger trg_sync_product_showroom_sku
after insert or update of mrp, sku_l, sku_w, sku_h, sku_dim_unit, sku_nw, sku_gw, sku_wt_unit
on public.products
for each row execute function public.sync_product_showroom_sku();

select count(*) as showroom_product_rows,
       count(*) filter (where sku_l is not null or sku_w is not null or sku_h is not null) as rows_with_dimensions,
       count(*) filter (where sku_nw is not null or sku_gw is not null) as rows_with_weights
from public.showroom_items
where source_type = 'product';
