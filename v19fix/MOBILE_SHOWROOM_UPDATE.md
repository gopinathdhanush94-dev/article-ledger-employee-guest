# Mobile showroom update

## Changes
- Guest barcode lookup now calls `guest_lookup_showroom_product_v2`.
- EAN matching is digit-normalized, so a scanned EAN such as `8904132961982` matches the Employee Access product catalogue even when the showroom cache is missing.
- The lookup runs server-side and returns showroom-safe fields only; it does not expose MRP, SP or other internal pricing fields to the guest browser.
- A missing showroom row is created/repaired automatically after a successful guest scan.
- Mobile header is reflowed into a compact brand/search/actions layout instead of the oversized scan row shown in the previous screenshot.
- Popups, scanner and nested not-found dialog close when the user taps outside them.
- Mobile browser back/swipe-back closes the top showroom layer first: scanner → order history/favourite/cart → product detail, without leaving the showroom.
- Product navigation from a favourite/cart popup replaces the popup history layer cleanly, avoiding an extra back gesture.

## Supabase
Run `supabase/guest_barcode_lookup.sql` in SQL Editor, then test:

```sql
select id, ean, article_no, model, name
from public.guest_lookup_showroom_product_v2('8904132961982');
```

The expected article from the current project data is model `MW0028108-2`, description `Ho Gold Clr Oval Metal Basket 30X18X9Cm`.

## Quotation email policy
No quotation email is sent by the webapp. The guest submits a request, the designated employee sees it in Employee Access, enters pricing/availability, downloads the final quotation PDF, and shares it manually. No Resend/Accounts/employee quotation-email secrets are required.
