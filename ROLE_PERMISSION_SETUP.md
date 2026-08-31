# Article Ledger — Employee / Guest Roles & Permissions

This upgrade adds application-level roles and database-enforced permissions for the separate Employee/Guest deployment.

## Roles

- **Super Admin** — full internal access + user management
- **Admin** — view/add/edit/delete/history/data-quality + user management (cannot promote another user to Admin/Super Admin)
- **Editor** — view/add/edit/history
- **Viewer** — view/history only
- **Guest** — showroom account only; no internal Article Ledger access

## New employee onboarding

Employee signup creates an **employee / viewer / pending** profile. An Admin or Super Admin must activate it. This prevents a public signup from immediately gaining internal data access.

Guest signup creates a **guest / guest / active** profile and is kept outside the internal product/garment RLS policies.

## Supabase setup

1. Run `supabase/roles_permissions.sql` in Supabase SQL Editor.
2. Create the first employee account from the app.
3. In Supabase SQL Editor, promote your administrator once:

```sql
update public.user_profiles
set role = 'super_admin', status = 'active'
where email = 'YOUR-EMPLOYEE-EMAIL' and account_type = 'employee';
```

Do not expose this bootstrap SQL as a client-side function.

## Security model

The frontend hides controls based on the role, but the important protection is in Supabase RLS:

- only active employees can read `products` and `garments`;
- editors/admins/super-admins can add/edit;
- only admins/super-admins can delete;
- guests are denied internal product and garment reads;
- only admins/super-admins can update other user profiles.

The existing public product-read policy is intentionally removed by the migration. This means the database is no longer publicly readable.

## Important when sharing one Supabase project

Because Supabase RLS applies to the database itself, this security migration affects every application connected to the same Supabase project. The existing users are automatically bootstrapped as active employee/viewers unless their old metadata explicitly marked them as guests. Deploy the matching role-aware app before relying on the new public/guest flow.
