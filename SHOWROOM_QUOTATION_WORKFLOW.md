# Showroom quotation workflow — webapp only

## Customer flow
1. Registered guest scans/selects products.
2. Products are added to the cart with quantity and a required date per line.
3. Customer sees no MRP, selling price, line total or total MRP.
4. Customer previews and submits the quotation request.
5. The request is saved in Supabase and the non-priced request PDF downloads automatically.
6. **No quotation email is sent.** The request remains inside Article Ledger for the quotation user.

## Employee / designated quotation user flow
1. Open **Quotation Requests** from Employee Access.
2. Review submitted requests and customer contact details.
3. Enter availability, quoted unit price and an optional Accounts note for each line.
4. The screen calculates each line total and the total quotation value.
5. When every line has availability and a non-negative unit price, click **Mark quotation ready**.
6. The order becomes `quoted` and `quoted_at` is recorded.
7. Click **Download quotation PDF**.
8. Share the downloaded PDF manually with the customer using the company's normal communication method.

## Email policy
Quotation processing no longer uses Resend, automatic customer mail, Accounts mail, or employee mail forwarding. The old quotation Edge Functions are retained only as disabled endpoints; they do not send mail.

No quotation-related Resend secrets are required by the app.

## Barcode / scanner lookup
Guest mobile scanning first checks the loaded showroom catalogue. If a barcode is not in the loaded list, the app calls `guest_lookup_showroom_product_v2`, which safely looks up the code against the showroom cache and the internal product/garment source data. A successfully scanned source article is repaired into `showroom_items` with public-safe fields and becomes available to the guest showroom.

Run:
- `supabase/guest_barcode_lookup.sql`
- the existing showroom quotation migrations already used by the project

For the reported barcode `8904132961982`, the project data identifies it as model `MW0028108-2`, description `Ho Gold Clr Oval Metal Basket 30X18X9Cm`.
