-- Article Ledger — Showroom visibility defaults and category bulk-management support
-- Run once after showroom_schema.sql. Existing items become visible and unfeatured.

-- New showroom items are visible by default; none are featured by default.
alter table public.showroom_items
  alter column visible set default true,
  alter column featured set default false;

-- Normalize the current catalogue to the requested default state.
update public.showroom_items
set visible = true,
    featured = false,
    updated_at = now();

