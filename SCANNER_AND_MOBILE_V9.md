# Scanner + Mobile v9

## Barcode lookup
Run `supabase/guest_barcode_lookup_v3.sql` after the previous lookup migration. It replaces `guest_lookup_showroom_product_v2` and:
- authenticates the caller;
- requires an active guest profile;
- searches showroom_items first;
- falls back to the internal products catalogue used by Employee Access;
- returns only showroom-safe fields;
- creates/repairs a safe showroom item when the product exists internally but is missing from the showroom cache.

The SQL Editor cannot successfully call this RPC because SQL Editor queries do not carry a guest JWT. Test the underlying product with a direct SELECT in SQL Editor, or test the RPC from the signed-in Guest Showroom.

## Mobile
- compact 5-control action row;
- fixed multi-layer back handling without double-popping history;
- outside-tap dismissal remains enabled for popup and scanner overlays;
- tighter iPhone spacing and no intentional horizontal overflow.
