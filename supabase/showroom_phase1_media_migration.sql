-- Phase 1 showroom media enhancement. Safe, additive migration.
alter table if exists public.showroom_items
  add column if not exists video_url text;

comment on column public.showroom_items.video_url is
  'Optional product demonstration URL. Supports YouTube or direct MP4/WebM URLs.';

select pg_notify('pgrst', 'reload schema');
