-- ============================================================
-- SHOWROOM QUOTATION PRE-FLIGHT CHECK
-- Read-only. Run this before/after the hardening migration.
-- ============================================================

-- 1. Verify the parent/child foreign key is exactly correct.
select
  tc.constraint_name,
  kcu.column_name,
  ccu.table_schema as referenced_schema,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
 and tc.table_schema = ccu.table_schema
where tc.table_schema = 'public'
  and tc.table_name = 'showroom_order_items'
  and tc.constraint_name = 'showroom_order_items_order_id_fkey';

-- 2. Find orphan child rows. Expected: 0.
select count(*) as orphan_order_items
from public.showroom_order_items oi
left join public.showroom_orders o on o.id = oi.order_id
where o.id is null;

-- 3. Confirm the current submission function exists.
select
  p.oid::regprocedure as function_signature,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'submit_showroom_quotation_request';

-- 4. Check required columns on order items.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'showroom_order_items'
order by ordinal_position;
