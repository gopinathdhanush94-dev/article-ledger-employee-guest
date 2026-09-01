-- Article Ledger — Guest Showroom schema
-- Run AFTER roles_permissions.sql on the Employee/Guest Supabase project.

create table if not exists public.showroom_items (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('product','garment')),
  source_id uuid,
  ean text,
  article_no text,
  name text not null,
  brand text,
  model text,
  category text,
  description text,
  image_url text,
  features jsonb not null default '[]'::jsonb,
  dimensions text,
  sku_l numeric,
  sku_w numeric,
  sku_h numeric,
  sku_dim_unit text,
  sku_nw numeric,
  sku_gw numeric,
  sku_wt_unit text,
  featured boolean not null default false,
  visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_showroom_visible on public.showroom_items(visible);
create index if not exists idx_showroom_featured on public.showroom_items(featured);
create index if not exists idx_showroom_ean on public.showroom_items(ean);
create index if not exists idx_showroom_article on public.showroom_items(article_no);
create index if not exists idx_showroom_category on public.showroom_items(category);

create or replace function public.set_showroom_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_showroom_items_updated_at on public.showroom_items;
create trigger trg_showroom_items_updated_at
before update on public.showroom_items
for each row execute function public.set_showroom_updated_at();

alter table public.showroom_items enable row level security;

drop policy if exists "Guests can view visible showroom items" on public.showroom_items;
create policy "Guests can view visible showroom items"
on public.showroom_items for select to authenticated
using (
  visible = true
  and public.current_account_type() = 'guest'
  and public.current_app_role() = 'guest'
);

drop policy if exists "Active employees can view showroom items" on public.showroom_items;
create policy "Active employees can view showroom items"
on public.showroom_items for select to authenticated
using (public.is_active_employee());

drop policy if exists "Editors can create showroom items" on public.showroom_items;
create policy "Editors can create showroom items"
on public.showroom_items for insert to authenticated
with check (public.has_any_app_role(array['editor','admin','super_admin']) and public.is_active_employee());

drop policy if exists "Editors can update showroom items" on public.showroom_items;
create policy "Editors can update showroom items"
on public.showroom_items for update to authenticated
using (public.has_any_app_role(array['editor','admin','super_admin']) and public.is_active_employee())
with check (public.has_any_app_role(array['editor','admin','super_admin']) and public.is_active_employee());

drop policy if exists "Admins can delete showroom items" on public.showroom_items;
create policy "Admins can delete showroom items"
on public.showroom_items for delete to authenticated
using (public.has_any_app_role(array['admin','super_admin']) and public.is_active_employee());

-- Initial safe showroom seed from General Articles.
-- Only approved public-safe fields are copied. Internal fields such as MRP, supplier,
-- carton weights/costs, history and internal metadata are deliberately excluded.
insert into public.showroom_items (
  source_type, source_id, ean, article_no, name, brand, model, category,
  description, image_url, features, dimensions,
  sku_l, sku_w, sku_h, sku_dim_unit, sku_nw, sku_gw, sku_wt_unit,
  featured, visible
)
select
  'product', p.id, p.ean, p.article_no,
  coalesce(nullif(trim(p.description), ''), nullif(trim(p.model), ''), 'Article'),
  p.brand, p.model, p.category,
  p.description, p.image_url,
  '[]'::jsonb,
  case
    when p.sku_l is not null and p.sku_w is not null and p.sku_h is not null
      then concat(p.sku_l, ' × ', p.sku_w, ' × ', p.sku_h, coalesce(' ' || nullif(p.sku_dim_unit,''), ''))
    else null end,
  p.sku_l, p.sku_w, p.sku_h, p.sku_dim_unit, p.sku_nw, p.sku_gw, p.sku_wt_unit,
  false, false
from public.products p
where not exists (
  select 1 from public.showroom_items s
  where s.source_type = 'product' and s.source_id = p.id
);

-- Initial safe showroom seed from Garments.
insert into public.showroom_items (
  source_type, source_id, ean, article_no, name, brand, model, category,
  description, image_url, features, dimensions,
  sku_l, sku_w, sku_h, sku_dim_unit, sku_nw, sku_gw, sku_wt_unit,
  featured, visible
)
select distinct on (g.customer_model, g.color)
  'garment', g.id, g.ean, g.article,
  coalesce(nullif(trim(g.excel_name), ''), nullif(trim(g.customer_model), ''), 'Garment'),
  g.brand,
  coalesce(g.customer_model, g.model_name, g.model1),
  'Garments',
  g.description, g.image_url,
  '[]'::jsonb, null, null, null, null, null, null, null, null,
  false, false
from public.garments g
where not exists (
  select 1 from public.showroom_items s
  where s.source_type = 'garment' and s.source_id = g.id
);

-- To publish products, set visible=true only for items approved for showroom display.
-- Example:
-- update public.showroom_items set visible=true, featured=true where ean='8901234567890';
