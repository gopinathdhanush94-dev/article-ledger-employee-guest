-- G-RECORDS / ARTICLE LEDGER — PUBLIC SHOWROOM QR LOOKUP
--
-- QR labels are physical customer-facing labels. The QR URL must therefore
-- work even when the customer is not signed in. This function returns ONLY
-- fields already intended for the guest showroom and ONLY for visible rows.
-- It does not expose MRP, selling price, cost, supplier or other internal data.
-- It also performs no writes, so scanning a QR code can never unhide an item.

create or replace function public.public_lookup_showroom_product(p_code text)
returns table (
  id uuid, source_type text, source_id uuid, ean text, article_no text,
  name text, brand text, model text, category text, description text,
  image_url text, features jsonb, dimensions text,
  sku_l numeric, sku_w numeric, sku_h numeric, sku_dim_unit text,
  sku_nw numeric, sku_gw numeric, sku_wt_unit text,
  featured boolean, visible boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := trim(coalesce(p_code, ''));
  v_code text := lower(regexp_replace(v_raw, '[^a-zA-Z0-9]', '', 'g'));
  v_digits text := regexp_replace(v_raw, '[^0-9]', '', 'g');
  v_item public.showroom_items%rowtype;
begin
  if v_code = '' then return; end if;

  select s.* into v_item
  from public.showroom_items s
  where s.visible = true
    and (
      (v_digits <> '' and regexp_replace(coalesce(s.ean, ''), '[^0-9]', '', 'g') = v_digits)
      or lower(regexp_replace(coalesce(s.article_no, ''), '[^a-zA-Z0-9]', '', 'g')) = v_code
      or lower(regexp_replace(coalesce(s.model, ''), '[^a-zA-Z0-9]', '', 'g')) = v_code
      or lower(s.id::text) = lower(v_raw)
    )
  order by s.featured desc, s.updated_at desc
  limit 1;

  if v_item.id is null then return; end if;

  return query select
    v_item.id, v_item.source_type, null::uuid, v_item.ean, v_item.article_no,
    v_item.name, v_item.brand, v_item.model, v_item.category, v_item.description,
    v_item.image_url, v_item.features, v_item.dimensions,
    v_item.sku_l, v_item.sku_w, v_item.sku_h, v_item.sku_dim_unit,
    v_item.sku_nw, v_item.sku_gw, v_item.sku_wt_unit,
    v_item.featured, v_item.visible;
end;
$$;

revoke all on function public.public_lookup_showroom_product(text) from public;
grant execute on function public.public_lookup_showroom_product(text) to anon, authenticated;
