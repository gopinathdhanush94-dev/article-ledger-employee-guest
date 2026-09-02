-- ============================================================
-- Article Ledger — Supabase schema
-- Run this once in your Supabase project: SQL Editor -> New Query -> paste -> Run
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists products (
  id            uuid primary key default gen_random_uuid(),
  month         text,
  category      text not null,
  brand         text not null,
  model         text,
  description   text,
  ean           text unique,                 -- NULL allowed (Postgres allows many NULLs in a UNIQUE column);
                                               -- a real EAN value is always unique though.
  mrp           numeric,
  sp            numeric,
  hsn           text,
  article_no    text,
  marketed_by   text,
  master_qty    integer,
  inner_qty     integer,

  image_url     text,                         -- public URL in the "product-images" storage bucket

  sku_l         numeric, sku_w numeric, sku_h numeric,
  sku_dim_unit  text,
  sku_nw        numeric, sku_gw numeric,
  sku_wt_unit   text,

  master_l      numeric, master_w numeric, master_h numeric,
  master_dim_unit text,
  master_nw     numeric, master_gw numeric,
  master_wt_unit  text,

  inner_l       numeric, inner_w numeric, inner_h numeric,
  inner_dim_unit  text,
  inner_nw      numeric, inner_gw numeric,
  inner_wt_unit   text,

  custom        boolean default true,          -- true = added via the app, false = original bulk import
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- EAN must be exactly 13 digits when present (app also validates this, this is the DB-level backstop)
alter table products
  add constraint ean_13_digits
  check (ean is null or ean ~ '^\d{13}$');

create index if not exists idx_products_category on products (category);
create index if not exists idx_products_brand on products (brand);
create index if not exists idx_products_month on products (month);
create index if not exists idx_products_ean on products (ean);

-- keep updated_at fresh on every edit
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security
-- Anyone (even not logged in) can VIEW the catalog.
-- Only a signed-in user can add / edit / delete — this is the real,
-- server-enforced version of the "password" the old local file used.
-- ============================================================
alter table products enable row level security;

drop policy if exists "Public read access" on products;
create policy "Public read access"
  on products for select
  using (true);

drop policy if exists "Authenticated users can insert" on products;
create policy "Authenticated users can insert"
  on products for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update" on products;
create policy "Authenticated users can update"
  on products for update
  to authenticated
  using (true);

drop policy if exists "Authenticated users can delete" on products;
create policy "Authenticated users can delete"
  on products for delete
  to authenticated
  using (true);

-- ============================================================
-- Storage bucket for product images
-- (Run this part too — it's included here so it's all one script.
--  You can also create the bucket by hand in Storage -> New bucket,
--  name it exactly "product-images" and mark it Public, if this
--  block errors out on your plan.)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "Authenticated upload product images" on storage.objects;
create policy "Authenticated upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Authenticated update product images" on storage.objects;
create policy "Authenticated update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images');


-- ============================================================
-- Bulk Article No. update helper
-- ============================================================
-- Article No. bulk update helper
-- Run this once in Supabase SQL Editor.
-- The React app also has a slower direct-update fallback if this function is absent.


