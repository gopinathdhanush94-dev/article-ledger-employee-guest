-- Article Ledger: expanded audit history
-- Run once in Supabase SQL Editor AFTER audit_log_schema.sql.
-- Safe to re-run.

create table if not exists product_field_changes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  reason text,
  changed_by_email text,
  changed_by_id uuid,
  changed_at timestamptz default now()
);

alter table product_field_changes add column if not exists reason text;
alter table products add column if not exists pending_change_reason text;
create index if not exists idx_product_field_changes_product on product_field_changes(product_id, changed_at desc);
alter table product_field_changes enable row level security;
drop policy if exists "Authenticated can read change log" on product_field_changes;
create policy "Authenticated can read change log" on product_field_changes for select to authenticated using (true);

create or replace function log_product_field_changes()
returns trigger security definer set search_path = public language plpgsql as $$
declare actor_email text; actor_id uuid; change_reason text;
begin
  begin actor_email := auth.email(); actor_id := auth.uid(); exception when others then actor_email := null; actor_id := null; end;
  change_reason := new.pending_change_reason;

  if old.description is distinct from new.description then insert into product_field_changes(product_id,field_name,old_value,new_value,reason,changed_by_email,changed_by_id) values(new.id,'description',old.description,new.description,change_reason,actor_email,actor_id); end if;
  if old.category is distinct from new.category then insert into product_field_changes values(gen_random_uuid(),new.id,'category',old.category,new.category,change_reason,actor_email,actor_id,now()); end if;
  if old.brand is distinct from new.brand then insert into product_field_changes values(gen_random_uuid(),new.id,'brand',old.brand,new.brand,change_reason,actor_email,actor_id,now()); end if;
  if old.model is distinct from new.model then insert into product_field_changes values(gen_random_uuid(),new.id,'model',old.model,new.model,change_reason,actor_email,actor_id,now()); end if;
  if old.ean is distinct from new.ean then insert into product_field_changes values(gen_random_uuid(),new.id,'ean',old.ean,new.ean,change_reason,actor_email,actor_id,now()); end if;
  if old.hsn is distinct from new.hsn then insert into product_field_changes values(gen_random_uuid(),new.id,'hsn',old.hsn,new.hsn,change_reason,actor_email,actor_id,now()); end if;
  if old.article_no is distinct from new.article_no then insert into product_field_changes values(gen_random_uuid(),new.id,'article_no',old.article_no,new.article_no,change_reason,actor_email,actor_id,now()); end if;
  if old.marketed_by is distinct from new.marketed_by then insert into product_field_changes values(gen_random_uuid(),new.id,'marketed_by',old.marketed_by,new.marketed_by,change_reason,actor_email,actor_id,now()); end if;
  if old.month is distinct from new.month then insert into product_field_changes values(gen_random_uuid(),new.id,'month',old.month,new.month,change_reason,actor_email,actor_id,now()); end if;
  if old.mrp is distinct from new.mrp then insert into product_field_changes values(gen_random_uuid(),new.id,'mrp',old.mrp::text,new.mrp::text,change_reason,actor_email,actor_id,now()); end if;
  if old.sp is distinct from new.sp then insert into product_field_changes values(gen_random_uuid(),new.id,'sp',old.sp::text,new.sp::text,change_reason,actor_email,actor_id,now()); end if;
  if old.master_qty is distinct from new.master_qty then insert into product_field_changes values(gen_random_uuid(),new.id,'master_qty',old.master_qty::text,new.master_qty::text,change_reason,actor_email,actor_id,now()); end if;
  if old.inner_qty is distinct from new.inner_qty then insert into product_field_changes values(gen_random_uuid(),new.id,'inner_qty',old.inner_qty::text,new.inner_qty::text,change_reason,actor_email,actor_id,now()); end if;
  if old.image_url is distinct from new.image_url then insert into product_field_changes values(gen_random_uuid(),new.id,'image_url',old.image_url,new.image_url,change_reason,actor_email,actor_id,now()); end if;

  if old.sku_l is distinct from new.sku_l then insert into product_field_changes values(gen_random_uuid(),new.id,'sku_l',old.sku_l::text,new.sku_l::text,change_reason,actor_email,actor_id,now()); end if;
  if old.sku_w is distinct from new.sku_w then insert into product_field_changes values(gen_random_uuid(),new.id,'sku_w',old.sku_w::text,new.sku_w::text,change_reason,actor_email,actor_id,now()); end if;
  if old.sku_h is distinct from new.sku_h then insert into product_field_changes values(gen_random_uuid(),new.id,'sku_h',old.sku_h::text,new.sku_h::text,change_reason,actor_email,actor_id,now()); end if;
  if old.sku_dim_unit is distinct from new.sku_dim_unit then insert into product_field_changes values(gen_random_uuid(),new.id,'sku_dim_unit',old.sku_dim_unit,new.sku_dim_unit,change_reason,actor_email,actor_id,now()); end if;
  if old.sku_nw is distinct from new.sku_nw then insert into product_field_changes values(gen_random_uuid(),new.id,'sku_nw',old.sku_nw::text,new.sku_nw::text,change_reason,actor_email,actor_id,now()); end if;
  if old.sku_gw is distinct from new.sku_gw then insert into product_field_changes values(gen_random_uuid(),new.id,'sku_gw',old.sku_gw::text,new.sku_gw::text,change_reason,actor_email,actor_id,now()); end if;
  if old.master_l is distinct from new.master_l then insert into product_field_changes values(gen_random_uuid(),new.id,'master_l',old.master_l::text,new.master_l::text,change_reason,actor_email,actor_id,now()); end if;
  if old.master_w is distinct from new.master_w then insert into product_field_changes values(gen_random_uuid(),new.id,'master_w',old.master_w::text,new.master_w::text,change_reason,actor_email,actor_id,now()); end if;
  if old.master_h is distinct from new.master_h then insert into product_field_changes values(gen_random_uuid(),new.id,'master_h',old.master_h::text,new.master_h::text,change_reason,actor_email,actor_id,now()); end if;
  if old.master_dim_unit is distinct from new.master_dim_unit then insert into product_field_changes values(gen_random_uuid(),new.id,'master_dim_unit',old.master_dim_unit,new.master_dim_unit,change_reason,actor_email,actor_id,now()); end if;
  if old.master_nw is distinct from new.master_nw then insert into product_field_changes values(gen_random_uuid(),new.id,'master_nw',old.master_nw::text,new.master_nw::text,change_reason,actor_email,actor_id,now()); end if;
  if old.master_gw is distinct from new.master_gw then insert into product_field_changes values(gen_random_uuid(),new.id,'master_gw',old.master_gw::text,new.master_gw::text,change_reason,actor_email,actor_id,now()); end if;
  if old.inner_l is distinct from new.inner_l then insert into product_field_changes values(gen_random_uuid(),new.id,'inner_l',old.inner_l::text,new.inner_l::text,change_reason,actor_email,actor_id,now()); end if;
  if old.inner_w is distinct from new.inner_w then insert into product_field_changes values(gen_random_uuid(),new.id,'inner_w',old.inner_w::text,new.inner_w::text,change_reason,actor_email,actor_id,now()); end if;
  if old.inner_h is distinct from new.inner_h then insert into product_field_changes values(gen_random_uuid(),new.id,'inner_h',old.inner_h::text,new.inner_h::text,change_reason,actor_email,actor_id,now()); end if;
  if old.inner_dim_unit is distinct from new.inner_dim_unit then insert into product_field_changes values(gen_random_uuid(),new.id,'inner_dim_unit',old.inner_dim_unit,new.inner_dim_unit,change_reason,actor_email,actor_id,now()); end if;
  if old.inner_nw is distinct from new.inner_nw then insert into product_field_changes values(gen_random_uuid(),new.id,'inner_nw',old.inner_nw::text,new.inner_nw::text,change_reason,actor_email,actor_id,now()); end if;
  if old.inner_gw is distinct from new.inner_gw then insert into product_field_changes values(gen_random_uuid(),new.id,'inner_gw',old.inner_gw::text,new.inner_gw::text,change_reason,actor_email,actor_id,now()); end if;

  return new;
end; $$;

drop trigger if exists trg_log_product_field_changes on products;
create trigger trg_log_product_field_changes after update on products for each row execute function log_product_field_changes();
