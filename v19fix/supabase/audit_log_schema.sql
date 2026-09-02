-- ============================================================
-- Article Ledger — product change history (audit trail) + reason tracking
-- Run this entire file in Supabase SQL Editor, after schema.sql.
-- Safe to re-run in full any time — every statement either creates
-- something only if it doesn't already exist, or replaces it cleanly.
--
-- Automatically records who changed what and when, whenever MRP, EAN,
-- Selling Price, HSN, or Master/Inner Carton Qty/Dimensions are edited on
-- an existing product. For MRP, EAN, Selling Price, HSN, Master Qty, and
-- Inner Qty specifically, the app prompts for a reason before saving, and
-- that reason is stored alongside the change.
-- ============================================================

-- A transient column the app writes to as part of the same UPDATE
-- statement that changes a tracked field — this is how the reason the
-- user typed makes it into the trigger below, reliably, in the same
-- database transaction (no cross-request state needed).
alter table products add column if not exists pending_change_reason text;

create table if not exists product_field_changes (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid references products(id) on delete cascade,
  field_name       text not null,
  old_value        text,
  new_value        text,
  reason           text,
  changed_by_email text,
  changed_by_id    uuid,
  changed_at       timestamptz default now()
);

-- In case this table already existed from an earlier version of this file
-- (without the reason column), add it now.
alter table product_field_changes add column if not exists reason text;

create index if not exists idx_product_field_changes_product on product_field_changes (product_id, changed_at desc);

alter table product_field_changes enable row level security;

drop policy if exists "Authenticated can read change log" on product_field_changes;
create policy "Authenticated can read change log"
  on product_field_changes for select
  to authenticated
  using (true);

-- The trigger function below is SECURITY DEFINER, so it can insert into
-- product_field_changes regardless of who performed the UPDATE — no INSERT
-- policy is needed for regular users.

create or replace function log_product_field_changes()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  actor_email text;
  actor_id uuid;
  change_reason text;
begin
  begin
    actor_email := auth.email();
    actor_id := auth.uid();
  exception when others then
    actor_email := null;
    actor_id := null;
  end;

  change_reason := new.pending_change_reason;

  if old.ean is distinct from new.ean then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'ean', old.ean, new.ean, change_reason, actor_email, actor_id);
  end if;

  if old.hsn is distinct from new.hsn then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'hsn', old.hsn, new.hsn, change_reason, actor_email, actor_id);
  end if;

  if old.mrp is distinct from new.mrp then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'mrp', old.mrp::text, new.mrp::text, change_reason, actor_email, actor_id);
  end if;

  if old.sp is distinct from new.sp then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'sp', old.sp::text, new.sp::text, change_reason, actor_email, actor_id);
  end if;

  if old.master_qty is distinct from new.master_qty then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'master_qty', old.master_qty::text, new.master_qty::text, change_reason, actor_email, actor_id);
  end if;

  if old.inner_qty is distinct from new.inner_qty then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'inner_qty', old.inner_qty::text, new.inner_qty::text, change_reason, actor_email, actor_id);
  end if;

  -- Dimensions are still tracked automatically, just without a required reason prompt in the app.
  if old.master_l is distinct from new.master_l then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'master_l', old.master_l::text, new.master_l::text, change_reason, actor_email, actor_id);
  end if;

  if old.master_w is distinct from new.master_w then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'master_w', old.master_w::text, new.master_w::text, change_reason, actor_email, actor_id);
  end if;

  if old.master_h is distinct from new.master_h then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'master_h', old.master_h::text, new.master_h::text, change_reason, actor_email, actor_id);
  end if;

  if old.master_dim_unit is distinct from new.master_dim_unit then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'master_dim_unit', old.master_dim_unit, new.master_dim_unit, change_reason, actor_email, actor_id);
  end if;

  if old.inner_l is distinct from new.inner_l then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'inner_l', old.inner_l::text, new.inner_l::text, change_reason, actor_email, actor_id);
  end if;

  if old.inner_w is distinct from new.inner_w then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'inner_w', old.inner_w::text, new.inner_w::text, change_reason, actor_email, actor_id);
  end if;

  if old.inner_h is distinct from new.inner_h then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'inner_h', old.inner_h::text, new.inner_h::text, change_reason, actor_email, actor_id);
  end if;

  if old.inner_dim_unit is distinct from new.inner_dim_unit then
    insert into product_field_changes (product_id, field_name, old_value, new_value, reason, changed_by_email, changed_by_id)
    values (new.id, 'inner_dim_unit', old.inner_dim_unit, new.inner_dim_unit, change_reason, actor_email, actor_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_product_field_changes on products;
create trigger trg_log_product_field_changes
  after update on products
  for each row execute function log_product_field_changes();
