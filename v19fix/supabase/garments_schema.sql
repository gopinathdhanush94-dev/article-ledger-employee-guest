-- ============================================================
-- Article Ledger — Garments schema (run AFTER supabase/schema.sql)
-- Run this once: Supabase SQL Editor -> New Query -> paste -> Run
--
-- One row per size/color SKU (matches how the source spreadsheets are laid
-- out: a "style" like a jacket has one row per size, and each color variant
-- repeats the block). The app groups rows by (excel_name, color, customer_model)
-- to show one card per garment with its full size run inside.
-- ============================================================

create table if not exists garments (
  id              uuid primary key default gen_random_uuid(),

  source_file     text,        -- e.g. "2026_LIVESMEART"
  sheet           text,        -- e.g. "JAN"

  excel_name      text,        -- style name, e.g. "Puffer Jacket Girls"
  model_name      text,        -- e.g. "JACKET"
  model1          text,        -- internal model code, e.g. "FM22790 K"
  brand           text not null,
  description     text,        -- fabric/material description
  color           text,
  customer_model  text,        -- customer-facing model code, e.g. "BKGJACKCGI5050"
  origin          text,
  moi             text,        -- month of import
  mfd             text,        -- month of dispatch/manufacture

  size            text,
  ratio           numeric,     -- set-packing quantity for this size within one assortment carton
  bottom_met_size text,
  top_met_size    text,

  master_ean      text,        -- shared EAN for the whole style (assortment carton)
  master_article  text,
  ean             text,        -- EAN for this specific size/color SKU
  article         text,
  ctn_no          text,

  mrp             numeric,
  rrp             numeric,

  image_url       text,        -- public URL in the "garment-images" storage bucket

  custom          boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_garments_brand on garments (brand);
create index if not exists idx_garments_model_name on garments (model_name);
create index if not exists idx_garments_color on garments (color);
create index if not exists idx_garments_ean on garments (ean);
create index if not exists idx_garments_group on garments (excel_name, color, customer_model);

drop trigger if exists trg_garments_updated_at on garments;
create trigger trg_garments_updated_at
  before update on garments
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security — same rules as products: public can view,
-- only signed-in users can add / edit / delete.
-- ============================================================
alter table garments enable row level security;

drop policy if exists "Public read access" on garments;
create policy "Public read access"
  on garments for select
  using (true);

drop policy if exists "Authenticated users can insert" on garments;
create policy "Authenticated users can insert"
  on garments for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update" on garments;
create policy "Authenticated users can update"
  on garments for update
  to authenticated
  using (true);

drop policy if exists "Authenticated users can delete" on garments;
create policy "Authenticated users can delete"
  on garments for delete
  to authenticated
  using (true);

-- ============================================================
-- Storage bucket for garment images
-- ============================================================
insert into storage.buckets (id, name, public)
values ('garment-images', 'garment-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read garment images" on storage.objects;
create policy "Public read garment images"
  on storage.objects for select
  using (bucket_id = 'garment-images');

drop policy if exists "Authenticated upload garment images" on storage.objects;
create policy "Authenticated upload garment images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'garment-images');

drop policy if exists "Authenticated update garment images" on storage.objects;
create policy "Authenticated update garment images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'garment-images');
