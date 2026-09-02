# Professional showroom quotation request PDF update

Updated `src/components/GuestShowroom.jsx` to:
- use product description/model/article number fallback instead of displaying placeholder `Untitled Product` when a valid `description` exists;
- generate a professional table-based customer-facing PDF;
- include request number, customer, email, requested item count;
- table columns: S.No, Product description, EAN, Qty, Required date;
- include total quantity and customer comments;
- keep all MRP/selling price/price totals out of the customer-facing document;
- add page headers/footers and multi-page table support.
