# Phase 1 Guest Showroom Upgrade

This release adds customer-facing showroom enhancements without removing the existing QR, product detail, favourites, cart, quotation, showroom visibility, roles, or permissions workflows.

## Included
- Optional product video support on showroom items (`video_url`).
- Guest product detail supports YouTube links and direct MP4/WebM/Ogg videos.
- Featured product cards show a subtle Video badge when media is available.
- Showroom Manager includes a per-product Media control for adding/editing/removing video URLs.
- New Arrivals section automatically shows the latest four visible showroom items.
- Visual Shop by Category tiles with representative product imagery and product counts.
- Category tiles preserve the existing catalogue and category filtering behavior.

## Supabase migration
Run `supabase/showroom_phase1_media_migration.sql` once in the project's Supabase SQL Editor before adding product videos.

Video URLs are optional. Existing products remain unchanged until a manager adds a video URL.
