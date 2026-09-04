# Premium Selection — final showroom layout

- Guest Showroom order is: Welcome → Premium Selection → Handpicked Featured → Collection.
- Premium Selection is now independent from Handpicked Featured products.
- Employees can mark products as Premium separately and set Premium order with left/right controls.
- Premium products are excluded from the Handpicked Featured grid, preventing duplicate products on the homepage.
- Premium remains a single horizontal carousel; additional products continue on the same row rather than creating another row.
- Existing Featured selection, QR scanning, favourites, cart, quotation workflow, showroom visibility, roles and permissions remain unchanged.

## Database migration
Run `supabase/showroom_premium_selection_migration.sql` once in Supabase. It adds `premium_selected` and `premium_rank` without changing existing Featured records.
