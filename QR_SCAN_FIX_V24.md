# QR scan / lookup fix v24

## What changed
- QR label preview and PDF now encode the same `?qr=<EAN/article/model>` payload.
- QR renderer now uses a full 4-module quiet zone and a slightly larger 34mm QR area for reliable phone-camera decoding after printing.
- Guest showroom scanner now uses the public `public_lookup_showroom_product` RPC instead of the authenticated guest-only legacy RPC.
- Guest direct QR entry remains view-only and does not require a guest login.
- Scanner now extracts `qr`, `product`, `ean`, `article`, and `model` query parameters from scanned URLs before lookup.
- Employee General/Catalog scanner now has a server-side lookup fallback so a QR can be found even when the product is outside the current catalogue filter/page.
- Employee lookup resolves the original product from showroom_items when needed.

## Supabase
The existing `supabase/public_showroom_qr_lookup.sql` must be installed. No new migration is required beyond that RPC.

## Important behavior
- Hidden showroom items are not automatically made visible by the public QR lookup.
- Customer QR access exposes only showroom-safe product fields.
- Employee scanning resolves the full internal product record when the QR represents a General Article.
