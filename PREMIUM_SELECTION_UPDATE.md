# Premium Selection Update

## What changed
- Added a premium horizontal auto-scrolling **Premium Selection** ribbon to the top of the Guest Showroom.
- Premium products use the existing showroom `featured` flag, so existing visibility/featured workflows remain intact.
- Added `featured_rank` to persist the employee-defined Premium Selection order.
- Showroom Manager now includes a Premium Selection ordering panel with left/right controls.
- Existing QR scanning, product details, favourites, cart, quotation requests, order history, showroom visibility, roles and permissions are unchanged.

## Database migration
Run `supabase/showroom_premium_selection_migration.sql` once against the existing Supabase database. It adds `featured_rank`, creates an index, and assigns an initial deterministic order to currently featured products.

The Guest Showroom reads `featured_rank` first and falls back to the existing featured state for display logic; the migration is required for employees to persist the new order.
