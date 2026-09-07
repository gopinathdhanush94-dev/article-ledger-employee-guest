-- G-RECORDS / ARTICLE LEDGER
-- Guest-safe garment metadata for the Product Showroom.
-- The garments table remains employee-only; this SECURITY DEFINER function
-- exposes only metadata already intended for visible showroom garments.

create or replace function public.public_showroom_garment_meta()
returns table (
  showroom_id uuid,
  style_name text,
  model text,
  image_url text,
  fabric text,
  colors jsonb,
  sizes jsonb,
  master_ean text
)
language sql
security definer
set search_path = public
as $$
  with anchors as (
    select
      s.id as showroom_id,
      s.model as showroom_model,
      g.id as anchor_id,
      g.excel_name,
      g.customer_model,
      g.model_name,
      g.model1,
      g.image_url as anchor_image,
      g.description as anchor_description,
      g.master_ean,
      coalesce(nullif(trim(g.customer_model), ''), nullif(trim(g.model1), ''), nullif(trim(g.model_name), ''), nullif(trim(s.model), '')) as style_key
    from public.showroom_items s
    join public.garments g on g.id = s.source_id
    where s.visible = true
      and s.source_type = 'garment'
  ),
  expanded as (
    select
      a.showroom_id,
      a.excel_name,
      a.customer_model,
      a.model_name,
      a.model1,
      a.showroom_model,
      a.anchor_image,
      a.anchor_description,
      a.master_ean,
      g.image_url,
      g.description,
      g.color,
      g.size,
      coalesce(nullif(trim(g.customer_model), ''), nullif(trim(g.model1), ''), nullif(trim(g.model_name), ''), nullif(trim(a.showroom_model), '')) as row_style_key
    from anchors a
    join public.garments g
      on coalesce(nullif(trim(g.customer_model), ''), nullif(trim(g.model1), ''), nullif(trim(g.model_name), ''), nullif(trim(a.showroom_model), '')) = a.style_key
  ),
  aggregated as (
    select
      e.showroom_id,
      max(coalesce(nullif(trim(e.excel_name), ''), nullif(trim(e.customer_model), ''), nullif(trim(e.model_name), ''), nullif(trim(e.model1), ''), 'Garment')) as style_name,
      max(coalesce(nullif(trim(e.customer_model), ''), nullif(trim(e.model_name), ''), nullif(trim(e.model1), ''), nullif(trim(e.showroom_model), ''))) as model,
      max(e.image_url) filter (where nullif(trim(e.image_url), '') is not null) as image_url,
      max(e.anchor_description) filter (where nullif(trim(e.anchor_description), '') is not null) as fabric,
      coalesce(jsonb_agg(distinct trim(e.color) order by trim(e.color)) filter (where nullif(trim(e.color), '') is not null), '[]'::jsonb) as colors,
      coalesce(jsonb_agg(distinct trim(e.size) order by trim(e.size)) filter (where nullif(trim(e.size), '') is not null), '[]'::jsonb) as sizes,
      max(e.master_ean) filter (where nullif(trim(e.master_ean), '') is not null) as master_ean
    from expanded e
    group by e.showroom_id
  )
  select showroom_id, style_name, model, image_url, fabric, colors, sizes, master_ean
  from aggregated;
$$;

revoke all on function public.public_showroom_garment_meta() from public;
grant execute on function public.public_showroom_garment_meta() to anon, authenticated;
