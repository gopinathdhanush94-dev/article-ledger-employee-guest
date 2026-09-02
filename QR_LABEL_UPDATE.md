# Showroom QR Label Generator

The Employee Showroom Manager now supports printable QR labels for selected physical showroom articles.

## Workflow
1. Open **Showroom** in Employee access.
2. Tick the products physically present in the showroom.
3. Use **Generate QR Labels**.
4. Review the selected labels.
5. Download the PDF.
6. Print at **10 cm × 5 cm** and place each label with its product.

Each PDF page is exactly 100 mm × 50 mm and contains:
- QR code that opens the guest showroom product details for that article
- Article / SKU number
- Model
- Description
- L × B × H SKU dimension details
- MRP
- EAN (when available)

MRP is read only when the employee generates the labels from the internal `products` / `garments` tables. It is not added to the guest showroom data returned by `GuestShowroom`.

No Supabase migration is required for this feature.
