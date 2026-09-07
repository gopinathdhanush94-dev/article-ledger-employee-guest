# Garment Showroom Upgrade

- Garment detail uses **Fabric** instead of Description.
- Guest garment products are enriched from the public `garments` table using the showroom item's `source_id`.
- Available sizes are shown as chips.
- Available colours for the customer model are shown.
- Garment category is derived from sizes:
  - Kids: 2-3, 3-4, 5-6, 7-8
  - Teen: 9-10, 11-12, 13-14
  - Adult: XS, S, M, L, XL, 2XL and numeric adult sizes 28–38
  - Plus: 3XL, 4XL, 5XL
- Mixed size families are labelled `Mixed Sizes`.
- The same enrichment is applied when opening a garment through the guest QR lookup.
- No database migration is required; source garment data remains unchanged.
