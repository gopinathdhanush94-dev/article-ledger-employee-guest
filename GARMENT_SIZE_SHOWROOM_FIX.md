# Garment Size / Colour / Navigation Fix

## Guest Showroom
- Garment showroom records now include `source_id` in the showroom-items query so garment metadata can be resolved from the `garments` table.
- Added a fallback resolver using EAN, article number, customer model, or internal model for older/public QR rows that do not carry `source_id`.
- Guest garment detail now exposes Fabric, size-category, available colours, available sizes, Master EAN and Master Article.
- Available sizes are collected across the complete garment style/model, not only the colour used by the selected showroom row.
- Guest category is derived from the size run:
  - Kids: 2-3, 3-4, 5-6, 7-8
  - Teen: 9-10, 11-12, 13-14
  - Adult: XS, S, M, L, XL, 2XL, 28, 30, 34, 36, 38
  - Plus: 3XL, 4XL, 5XL
  - Mixed Sizes when a style spans more than one group.

## Employee Garments
- Added an `All size categories` filter with Kids / Teen / Adult / Plus / Mixed Sizes where present.
- Garment cards now show the derived size category and retain the garment type as a secondary tag.
- Existing brand, garment type, month, year, search, scanner, export and catalogue functions are retained.

## Employee Product / Garment Modal Navigation
- Previous / Next controls are pinned to the visible viewport edges so wide desktop detail modals cannot cover them.
- Controls remain usable on mobile with smaller touch targets.

No database migration is required.
