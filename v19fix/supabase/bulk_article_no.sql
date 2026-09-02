-- Article No. bulk update helper
-- Run this once in Supabase SQL Editor.
-- The React app also has a slower direct-update fallback if this function is absent.

create or replace function public.bulk_update_article_numbers(mappings jsonb)
returns table(updated integer, failed integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  u integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  with input as (
    select
      trim(x->>'ean') as ean,
      nullif(trim(x->>'article_no'), '') as article_no
    from jsonb_array_elements(coalesce(mappings, '[]'::jsonb)) x
  ),
  changed as (
    update public.products p
    set article_no = i.article_no
    from input i
    where p.ean = i.ean
      and p.article_no is distinct from i.article_no
    returning p.id
  )
  select count(*)::integer into u from changed;

  return query select u, 0;
end;
$$;

revoke all on function public.bulk_update_article_numbers(jsonb) from public;
grant execute on function public.bulk_update_article_numbers(jsonb) to authenticated;
