-- Add the per-line required date used by showroom quotation requests.
alter table public.showroom_order_items
  add column if not exists required_date date;

-- Existing rows can remain NULL; new showroom requests validate the date in the UI.
select pg_notify('pgrst', 'reload schema');
