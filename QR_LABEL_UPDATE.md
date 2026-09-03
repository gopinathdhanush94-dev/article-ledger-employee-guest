# Showroom QR Labels — Customer View

The Showroom manager can select physically available products and download 10 cm × 5 cm QR labels.

Each label contains the QR code, Article/SKU, Model, Description, L × B × H, MRP and EAN.

The QR code now stores the product's EAN (or Article No./Model as fallback), rather than the internal showroom UUID. This makes the printed code readable by both the Guest scanner and the Employee scanner.

When a customer scans a printed label, the app opens the same **Guest Showroom product-detail view** directly. No employee/internal catalogue is exposed. The QR landing view is read-only and only returns products marked `visible = true`.

## Required Supabase migration

Run:

`supabase/public_showroom_qr_lookup.sql`

This creates `public.public_lookup_showroom_product(text)` as a `SECURITY DEFINER` function and grants it to `anon` and `authenticated`. It returns only showroom-safe fields and never returns MRP/pricing.

## Behaviour

- Employee Showroom: select rows → Generate QR Labels → Download PDF.
- Customer phone camera: scans QR → opens exact product in Guest Showroom detail view.
- Guest scanner: EAN/Article/Model QR payload resolves to the same product.
- Employee scanner: the EAN/Article/Model QR payload resolves against the internal catalogue.
- Hidden showroom rows are not exposed by the public QR URL.
- Scanning never changes `visible` or `featured` state.
