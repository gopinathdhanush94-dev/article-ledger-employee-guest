# Showroom quotation workflow

## Customer flow
1. Registered guest scans/selects products.
2. Products are added to the cart with quantity and a required date per line.
3. Customer sees no MRP, selling price, line total or total MRP.
4. Customer adds optional comments and previews the quotation request.
5. Submit creates a quotation request in Supabase and automatically downloads a PDF containing only requested product details.
6. A Supabase Edge Function emails the registered guest and the Accounts mailbox.

## Accounts flow
Employees can open **Quotation Requests**, enter availability, quoted unit price and an Accounts note for each line, then click **Send quotation update**. The update email goes to the registered guest.

## Setup
Run `supabase/showroom_quotation_migration.sql` in Supabase SQL Editor.

Deploy both Edge Functions:
- `send-showroom-quotation`
- `send-showroom-quote-update`

Configure these Supabase Edge Function secrets:
- `RESEND_API_KEY`
- `SHOWROOM_FROM_EMAIL` (must be a verified sender/domain in Resend)
- `ACCOUNTS_EMAIL`

The Vite app only needs the existing Supabase URL/anon key.
