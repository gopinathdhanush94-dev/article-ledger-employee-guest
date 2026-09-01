# Showroom quotation hardening

This update makes quotation submission a single PostgreSQL transaction through `submit_showroom_quotation_request` and persists the Guest cart/quotation draft in localStorage so a page remount/reload can restore the open cart/preview.

## Supabase
Run `supabase/showroom_order_hardening.sql` once. It refuses to alter the order foreign key if orphaned order-item rows exist.

Use `supabase/showroom_order_preflight.sql` to verify the FK, RPC and columns.

## Frontend draft persistence
The Guest Showroom persists:
- cart IDs
- cart quantities
- required dates per cart line
- comments
- open cart/favourites popup
- quotation preview state

A successful submission clears the draft.
