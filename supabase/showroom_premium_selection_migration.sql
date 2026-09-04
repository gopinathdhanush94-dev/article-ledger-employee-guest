-- Premium Selection ordering for the Guest Showroom.
-- Safe to run once on an existing showroom_items table.
alter table if exists public.showroom_items
  add column if not exists featured_rank integer;

create index if not exists idx_showroom_featured_rank
  on public.showroom_items(featured, featured_rank);

-- Preserve the current Featured set while giving it a deterministic initial order.
with ranked as (
  select id,
         row_number() over (
           order by featured desc, created_at desc nulls last, id
         ) as rank_no
  from public.showroom_items
  where featured = true
)
update public.showroom_items s
set featured_rank = r.rank_no
from ranked r
where s.id = r.id
  and s.featured_rank is null;
