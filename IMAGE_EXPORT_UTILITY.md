# Image Export Utility

Added a new **Image Export** section to Article Ledger.

## What it does
- Uses the existing `products` and `garments` data already loaded by the app.
- Reads public Supabase Storage image URLs from `image_url`.
- Searches by article, EAN, model, brand, or category.
- Filters by category.
- Shows matching records, records with images, unique image URLs, and ZIP batch count.
- Exports a complete CSV image manifest for the filtered records.
- Downloads image files into ZIP batches with category folders.
- Deduplicates identical image URLs within a batch.
- Does not modify Supabase data and requires no database migration.

## Access
The Image Export tab follows the existing `canViewGeneral` permission, so normal users who can view General articles can use it. Guest accounts remain blocked by the existing access system.

## Large libraries
ZIP downloads are intentionally batched (100 / 250 / 500 / 1,000 images per batch) to avoid trying to hold an entire large image library in one browser operation. The CSV manifest can still cover the complete filtered set.

## Supabase requirement
The screenshot-confirmed `product-images` and `garment-images` buckets are public, so the utility can fetch their public image URLs without exposing a service-role key.
