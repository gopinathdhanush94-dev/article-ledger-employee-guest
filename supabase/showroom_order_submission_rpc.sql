-- ============================================================
-- ARTICLE LEDGER — ATOMIC SHOWROOM QUOTATION SUBMISSION
--
-- Fixes client-side FK failures by creating the order and all
-- order items in ONE PostgreSQL transaction.
-- ============================================================

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
  v_exists boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one product is required.' using errcode = '22023';
  end if;

  select
    coalesce(up.email, au.email),
    coalesce(nullif(trim(up.full_name), ''), au.email, 'Registered Guest')
  into v_email, v_name
  from auth.users au
  left join public.user_profiles up on up.user_id = au.id
  where au.id = v_user_id;

  if v_email is null or v_email = '' then
    raise exception 'Registered guest email could not be determined.' using errcode = '22023';
  end if;

  -- Validate every line before creating anything.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_showroom_item_id := (v_item->>'showroom_item_id')::uuid;
    exception when others then
      raise exception 'Invalid showroom item ID.' using errcode = '22P02';
    end;

    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer, 1));

    if coalesce(v_item->>'required_date', '') = '' then
      raise exception 'Required date is missing for one or more products.' using errcode = '22023';
    end if;

    begin
      v_required_date := (v_item->>'required_date')::date;
    exception when others then
      raise exception 'Invalid required date.' using errcode = '22007';
    end;

    if v_required_date < current_date then
      raise exception 'Required date cannot be in the past.' using errcode = '22023';
    end if;

    select exists(
      select 1
      from public.showroom_items si
      where si.id = v_showroom_item_id
        and si.visible = true
    ) into v_exists;

    if not v_exists then
      raise exception 'One or more selected showroom products are no longer available.' using errcode = '23503';
    end if;
  end loop;

  -- Server-side request number. The UUID suffix makes collisions negligible,
  -- while the unique constraint on showroom_orders remains the final guard.
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

  -- Insert all order lines using the just-created order_id inside this same transaction.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.showroom_order_items (
      order_id,
      showroom_item_id,
      product_name,
      ean,
      quantity,
      required_date
    ) values (
      v_order_id,
      (v_item->>'showroom_item_id')::uuid,
      coalesce(nullif(trim(v_item->>'product_name'), ''), 'Product'),
      nullif(trim(v_item->>'ean'), ''),
      greatest(1, coalesce((v_item->>'quantity')::integer, 1)),
      (v_item->>'required_date')::date
    );
  end loop;

  return query select v_order_id, v_order_number;
end;
$$;

grant execute on function public.submit_showroom_quotation_request(jsonb, text) to authenticated;

comment on function public.submit_showroom_quotation_request(jsonb, text)
is 'Atomically creates a guest showroom quotation request and all of its line items.';

notify pgrst, 'reload schema';
