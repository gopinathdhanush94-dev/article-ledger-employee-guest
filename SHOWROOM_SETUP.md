# Guest Showroom — Initial Setup

This version adds the first showroom experience after Guest login.

## 1. Supabase
Run `supabase/showroom_schema.sql` after `supabase/roles_permissions.sql`.

The schema creates a safe `showroom_items` table. Guests can only read rows where `visible=true` and `account_type=guest`; they never query `products` or `garments` directly.

The seed section copies only public-safe fields into the showroom table. Seeded rows are intentionally `visible=false` until an employee approves them.

To publish an item:

```sql
update public.showroom_items
set visible=true, featured=true
where ean='YOUR-EAN';
```

## 2. Vercel
No new environment variables are required. Keep the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## 3. Guest experience included
- Showroom Home
- Featured products
- Category filters
- Product search
- Public product details
- Product image enlarge viewer
- QR/barcode scanner using the existing ZXing scanner
- URL deep link support: `?product=EAN`
- Guest sign out
