# Guest Showroom Performance Update

- Removed the complete Shop by category / EXPLORE section from Guest Showroom.
- Guest showroom now uses a lightweight session snapshot so a refresh can render immediately.
- Live showroom data is revalidated in the background.
- Base showroom products render before garment metadata enrichment finishes.
- Garment enrichment cannot block the first showroom render.
- Existing Browse Products category pills remain available.
- No database migration is required.
