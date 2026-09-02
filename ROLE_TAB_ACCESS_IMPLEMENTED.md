# Article Ledger — Role & Tab Access

Implemented from the approved matrix:

| Role | Home | General | Garments | Add Product | Showroom | Quotation Request |
|---|---|---|---|---|---|---|
| Viewer | View | View | View | — | — | — |
| Editor | Full | Full | Full | Full | — | — |
| Quotation Manager | View | View | View | View | Full | Full |
| Guest Manager | View | View | View | View | Full | — |
| Admin | Full | Full | Full | Full | Full | Full |
| Super Admin | Full | Full | Full | Full | Full | Full |

## User assignment

- Admin and Super Admin can open **Users** and assign roles/status to other users.
- Admin can assign Viewer, Editor, Quotation Manager, Guest Manager and Admin.
- Only Super Admin can assign Super Admin.
- A user cannot change their own role/status from the Users screen.
- Guest accounts remain role `guest`.

## Security

The SQL migration adds RLS enforcement for user profile management and showroom management. UI tab hiding is not the security boundary.
