-- ============================================================
-- G-RECORDS SHOWROOM — ORDER SUBMISSION HARDENING
-- Permanent fix for showroom order FK / schema drift.
--
-- Run once in Supabase SQL Editor, then refresh the PostgREST
-- schema. This does not delete quotation requests.
-- ============================================================

begin;

-- 1) Ensure required tables/columns exist.
create table if not exists public.showroom_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  customer_email text not null,
  customer_name text,
  status text not null default 'quotation_requested',
  comments text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.showroom_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  showroom_item_id uuid references public.showroom_items(id) on delete set null,
  product_name text not null,
  ean text,
  model text,
  category text,
  quantity integer not null default 1,
  required_date date,
  requested_image_url text,
  availability text,
  quoted_unit_price numeric,
  account_note text,
  quoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.showroom_orders
  add column if not exists customer_name text,
  add column if not exists status text default 'quotation_requested',
  add column if not exists comments text,
  add column if not exists submitted_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.showroom_order_items
  add column if not exists product_name text,
  add column if not exists ean text,
  add column if not exists model text,
  add column if not exists category text,
  add column if not exists quantity integer default 1,
  add column if not exists required_date date,
  add column if not exists requested_image_url text,
  add column if not exists availability text,
  add column if not exists quoted_unit_price numeric,
  add column if not exists account_note text,
  add column if not exists quoted_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- 2) Backfill/validate legacy rows before hardening.
update public.showroom_order_items
set quantity = 1
where quantity is null or quantity < 1;

update public.showroom_orders
set status = 'quotation_requested'
where status is null or status = '';

update public.showroom_orders
set submitted_at = coalesce(submitted_at, now()),
    updated_at = coalesce(updated_at, now());

update public.showroom_order_items
set created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now());

-- 3) Refuse to alter the FK if orphan item rows exist.
do $$
declare
  orphan_count integer;
begin
  select count(*) into orphan_count
  from public.showroom_order_items oi
  left join public.showroom_orders o on o.id = oi.order_id
  where o.id is null;

  if orphan_count > 0 then
    raise exception
      'Cannot harden showroom order FK: % orphaned showroom_order_items rows exist. Repair those rows first.',
      orphan_count;
  end if;
end $$;

-- 4) Make the order FK explicit and deterministic.
alter table public.showroom_order_items
  drop constraint if exists showroom_order_items_order_id_fkey;

alter table public.showroom_order_items
  add constraint showroom_order_items_order_id_fkey
  foreign key (order_id)
  references public.showroom_orders(id)
  on delete cascade;

-- 5) Safe constraints.
alter table public.showroom_order_items
  drop constraint if exists showroom_order_items_quantity_check;

alter table public.showroom_order_items
  add constraint showroom_order_items_quantity_check
  check (quantity > 0);

-- 6) Remove every old overload of the submission RPC.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name,
           p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'submit_showroom_quotation_request'
  loop
    execute 'drop function if exists ' || r.signature || ' cascade';
  end loop;
end $$;

-- 7) Recreate the submission API with strict validation and an atomic
-- parent/child write. The parent order is created first and the same
-- transaction immediately inserts every child row using that parent id.
create or replace function public.submit_showroom_quotation_request(
  p_items jsonb,
  p_comments text default null
)
returns table (
  id uuid,
  order_number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_name text;
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_showroom_item_id uuid;
  v_qty integer;
  v_required_date date;
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Invalid quotation request payload.' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_items);
  if v_count < 1 or v_count > 200 then
    raise exception 'Quotation must contain between 1 and 200 products.' using errcode = '22023';
  end if;

  select
    coalesce(nullif(trim(up.email), ''), au.email),
    coalesce(nullif(trim(up.full_name), ''), au.email, 'Registered Guest')
  into v_email, v_name
  from auth.users au
  left join public.user_profiles up on up.user_id = au.id
  where au.id = v_user_id;

  if coalesce(trim(v_email), '') = '' then
    raise exception 'Registered guest email could not be determined.' using errcode = '22023';
  end if;

  -- Strictly validate every item before creating the parent order.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_showroom_item_id := (v_item->>'showroom_item_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'One or more selected products are invalid.' using errcode = '22P02';
    end;

    if v_showroom_item_id is null then
      raise exception 'One or more selected products are invalid.' using errcode = '22023';
    end if;

    begin
      v_qty := (v_item->>'quantity')::integer;
    exception when invalid_text_representation then
      raise exception 'Quantity must be a whole number.' using errcode = '22P02';
    end;

    if v_qty is null or v_qty < 1 or v_qty > 100000 then
      raise exception 'Quantity must be between 1 and 100000.' using errcode = '22023';
    end if;

    if coalesce(trim(v_item->>'required_date'), '') = '' then
      raise exception 'Required date is missing for one or more products.' using errcode = '22023';
    end if;

    begin
      v_required_date := (v_item->>'required_date')::date;
    exception when invalid_datetime_format then
      raise exception 'One or more required dates are invalid.' using errcode = '22007';
    end;

    if v_required_date < current_date then
      raise exception 'Required date cannot be in the past.' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.showroom_items si
      where si.id = v_showroom_item_id
        and si.visible = true
    ) then
      raise exception 'One or more selected products are no longer available.' using errcode = '23503';
    end if;
  end loop;

  v_order_number := 'QR-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.showroom_orders (
    order_number,
    customer_user_id,
    customer_email,
    customer_name,
    status,
    comments
  ) values (
    v_order_number,
    v_user_id,
    v_email,
    v_name,
    'quotation_requested',
    nullif(trim(p_comments), '')
  )
  returning showroom_orders.id into v_order_id;

  -- The FK can only see this parent row because it is in the same
  -- PostgreSQL transaction. Child rows are inserted as one set-based write.
  insert into public.showroom_order_items (
    order_id,
    showroom_item_id,
    product_name,
    ean,
    quantity,
    required_date
  )
  select
    v_order_id,
    (j->>'showroom_item_id')::uuid,
    coalesce(nullif(trim(j->>'product_name'), ''), 'Product'),
    nullif(trim(j->>'ean'), ''),
    (j->>'quantity')::integer,
    (j->>'required_date')::date
  from jsonb_array_elements(p_items) j;

  return query select v_order_id, v_order_number;
end;
$$;

grant execute on function public.submit_showroom_quotation_request(jsonb, text) to authenticated;

-- 8) Keep useful indexes.
create index if not exists idx_showroom_orders_customer
  on public.showroom_orders(customer_user_id, submitted_at desc);

create index if not exists idx_showroom_orders_status
  on public.showroom_orders(status);

create index if not exists idx_showroom_order_items_order
  on public.showroom_order_items(order_id);

-- 9) RLS stays enabled. Guests only see their own requests; employees can
-- process requests later.
alter table public.showroom_orders enable row level security;
alter table public.showroom_order_items enable row level security;

notify pgrst, 'reload schema';

commit;
