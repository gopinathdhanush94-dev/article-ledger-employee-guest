-- ============================================================
-- G-RECORDS GUEST SHOWROOM — ROBUST BARCODE / ARTICLE LOOKUP v2
--
-- Run this once in Supabase SQL Editor.
-- Guest scanning uses this RPC instead of exposing the internal
-- products table to the browser. It returns showroom-safe fields only.
-- It searches EAN exactly by digits, then Article No./Model, then garments.
-- If the product exists in Employee Access but not in showroom_items,
-- a safe showroom row is created automatically.
-- ============================================================

create or replace function public.guest_lookup_showroom_product_v2(p_code text)
returns table (
  id uuid,
  source_type text,
  source_id uuid,
  ean text,
  article_no text,
  name text,
  brand text,
  model text,
  category text,
  description text,
  image_url text,
  features jsonb,
  dimensions text,
  sku_l numeric,
  sku_w numeric,
  sku_h numeric,
  sku_dim_unit text,
  sku_nw numeric,
  sku_gw numeric,
  sku_wt_unit text,
  featured boolean,
  visible boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := trim(coalesce(p_code, ''));
  v_code text := lower(regexp_replace(trim(coalesce(p_code, '')), '[^a-zA-Z0-9]', '', 'g'));
  v_digits text := regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g');
  v_item public.showroom_items%rowtype;
  v_product public.products%rowtype;
  v_garment public.garments%rowtype;
  v_existing public.showroom_items%rowtype;
begin
  if auth.uid() is null
     or public.current_account_type() <> 'guest'
     or public.current_app_role() <> 'guest' then
    raise exception 'Guest showroom access required.' using errcode = '42501';
  end if;

  if v_code = '' then
    return;
  end if;

  -- 1) Existing showroom row. A deliberate scan is allowed to open a
  -- hidden row, because the user has the physical code in front of them.
  select s.* into v_item
  from public.showroom_items s
  where (
      (v_digits <> '' and regexp_replace(coalesce(s.ean, ''), '[^0-9]', '', 'g') = v_digits)
      or lower(regexp_replace(coalesce(s.article_no, ''), '[^a-zA-Z0-9]', '', 'g')) = v_code
      or lower(regexp_replace(coalesce(s.model, ''), '[^a-zA-Z0-9]', '', 'g')) = v_code
      or lower(s.id::text) = lower(trim(coalesce(p_code, '')))
  )
  order by s.visible desc, s.updated_at desc
  limit 1;

  if v_item.id is not null then
    if not v_item.visible then
      update public.showroom_items
      set visible = true, updated_at = now()
      where id = v_item.id;
      v_item.visible := true;
    end if;

    return query select
      v_item.id, v_item.source_type, v_item.source_id, v_item.ean, v_item.article_no,
      v_item.name, v_item.brand, v_item.model, v_item.category, v_item.description,
      v_item.image_url, v_item.features, v_item.dimensions,
      v_item.sku_l, v_item.sku_w, v_item.sku_h, v_item.sku_dim_unit,
      v_item.sku_nw, v_item.sku_gw, v_item.sku_wt_unit,
      v_item.featured, v_item.visible;
    return;
  end if;

  -- 2) Employee Access product catalogue. This is deliberately queried
  -- inside SECURITY DEFINER so guest RLS never exposes price/cost fields.
  select p.* into v_product
  from public.products p
  where (
      (v_digits <> '' and regexp_replace(coalesce(p.ean, ''), '[^0-9]', '', 'g') = v_digits)
      or lower(regexp_replace(coalesce(p.article_no, ''), '[^a-zA-Z0-9]', '', 'g')) = v_code
      or lower(regexp_replace(coalesce(p.model, ''), '[^a-zA-Z0-9]', '', 'g')) = v_code
  )
  order by p.updated_at desc nulls last
  limit 1;

  if v_product.id is not null then
    select * into v_existing
    from public.showroom_items s
    where s.source_type = 'product' and s.source_id = v_product.id
    limit 1;

    if v_existing.id is null then
      insert into public.showroom_items (
        source_type, source_id, ean, article_no, name, brand, model, category,
        description, image_url, features, dimensions,
        sku_l, sku_w, sku_h, sku_dim_unit, sku_nw, sku_gw, sku_wt_unit,
        featured, visible
      ) values (
        'product', v_product.id, v_product.ean, v_product.article_no,
        coalesce(nullif(trim(v_product.description), ''), nullif(trim(v_product.model), ''), 'Article'),
        v_product.brand, v_product.model, v_product.category,
        v_product.description, v_product.image_url, '[]'::jsonb,
        case when v_product.sku_l is not null and v_product.sku_w is not null and v_product.sku_h is not null
          then concat(v_product.sku_l, ' × ', v_product.sku_w, ' × ', v_product.sku_h,
                      coalesce(' ' || nullif(v_product.sku_dim_unit, ''), '')) end,
        v_product.sku_l, v_product.sku_w, v_product.sku_h, v_product.sku_dim_unit,
        v_product.sku_nw, v_product.sku_gw, v_product.sku_wt_unit,
        false, true
      ) returning * into v_item;
    else
      update public.showroom_items
      set ean = v_product.ean,
          article_no = v_product.article_no,
          name = coalesce(nullif(trim(v_product.description), ''), nullif(trim(v_product.model), ''), name),
          brand = v_product.brand,
          model = v_product.model,
          category = v_product.category,
          description = v_product.description,
          image_url = v_product.image_url,
          sku_l = v_product.sku_l,
          sku_w = v_product.sku_w,
          sku_h = v_product.sku_h,
          sku_dim_unit = v_product.sku_dim_unit,
          sku_nw = v_product.sku_nw,
          sku_gw = v_product.sku_gw,
          sku_wt_unit = v_product.sku_wt_unit,
          dimensions = case when v_product.sku_l is not null and v_product.sku_w is not null and v_product.sku_h is not null
            then concat(v_product.sku_l, ' × ', v_product.sku_w, ' × ', v_product.sku_h,
                        coalesce(' ' || nullif(v_product.sku_dim_unit, ''), '')) end,
          visible = true,
          updated_at = now()
      where id = v_existing.id
      returning * into v_item;
    end if;

    return query select
      v_item.id, v_item.source_type, v_item.source_id, v_item.ean, v_item.article_no,
      v_item.name, v_item.brand, v_item.model, v_item.category, v_item.description,
      v_item.image_url, v_item.features, v_item.dimensions,
      v_item.sku_l, v_item.sku_w, v_item.sku_h, v_item.sku_dim_unit,
      v_item.sku_nw, v_item.sku_gw, v_item.sku_wt_unit,
      v_item.featured, v_item.visible;
    return;
  end if;

  -- 3) Garment catalogue fallback.
  select g.* into v_garment
  from public.garments g
  where (
      (v_digits <> '' and regexp_replace(coalesce(g.ean, ''), '[^0-9]', '', 'g') = v_digits)
      or lower(regexp_replace(coalesce(g.article, ''), '[^a-zA-Z0-9]', '', 'g')) = v_code
  )
  order by g.updated_at desc nulls last
  limit 1;

  if v_garment.id is not null then
    select * into v_existing
    from public.showroom_items s
    where s.source_type = 'garment' and s.source_id = v_garment.id
    limit 1;

    if v_existing.id is null then
      insert into public.showroom_items (
        source_type, source_id, ean, article_no, name, brand, model, category,
        description, image_url, features, dimensions,
        featured, visible
      ) values (
        'garment', v_garment.id, v_garment.ean, v_garment.article,
        coalesce(nullif(trim(v_garment.excel_name), ''), nullif(trim(v_garment.customer_model), ''), 'Garment'),
        v_garment.brand,
        coalesce(v_garment.customer_model, v_garment.model_name, v_garment.model1),
        'Garments', v_garment.description, v_garment.image_url, '[]'::jsonb, null,
        false, true
      ) returning * into v_item;
    else
      update public.showroom_items
      set ean = v_garment.ean,
          article_no = v_garment.article,
          name = coalesce(nullif(trim(v_garment.excel_name), ''), nullif(trim(v_garment.customer_model), ''), name),
          brand = v_garment.brand,
          model = coalesce(v_garment.customer_model, v_garment.model_name, v_garment.model1),
          category = 'Garments',
          description = v_garment.description,
          image_url = v_garment.image_url,
          visible = true,
          updated_at = now()
      where id = v_existing.id
      returning * into v_item;
    end if;

    return query select
      v_item.id, v_item.source_type, v_item.source_id, v_item.ean, v_item.article_no,
      v_item.name, v_item.brand, v_item.model, v_item.category, v_item.description,
      v_item.image_url, v_item.features, v_item.dimensions,
      v_item.sku_l, v_item.sku_w, v_item.sku_h, v_item.sku_dim_unit,
      v_item.sku_nw, v_item.sku_gw, v_item.sku_wt_unit,
      v_item.featured, v_item.visible;
  end if;
end;
$$;

grant execute on function public.guest_lookup_showroom_product_v2(text) to authenticated;

-- Keep the previous RPC name available for any older deployed client.
create or replace function public.guest_lookup_showroom_product(p_code text)
returns table (
  id uuid, source_type text, source_id uuid, ean text, article_no text,
  name text, brand text, model text, category text, description text,
  image_url text, features jsonb, dimensions text,
  sku_l numeric, sku_w numeric, sku_h numeric, sku_dim_unit text,
  sku_nw numeric, sku_gw numeric, sku_wt_unit text,
  featured boolean, visible boolean
)
language sql
security definer
set search_path = public
as $$
  select * from public.guest_lookup_showroom_product_v2(p_code);
$$;

grant execute on function public.guest_lookup_showroom_product(text) to authenticated;

notify pgrst, 'reload schema';

-- Optional verification after running this migration:
-- select id, ean, article_no, model, name
-- from public.guest_lookup_showroom_product_v2('8904132961982');
