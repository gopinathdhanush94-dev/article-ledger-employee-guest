# Quotation authorization

## Workflow
- There is no "Start pricing" step.
- A new request is immediately editable by the authorized quotation user.
- Enter availability, unit price and account note for each selected article.
- When every line is complete, click "Mark quotation ready".
- Download the final priced PDF and share it manually.
- Authorized users can delete a quotation request.

## Roles
- `quotation_manager`: dedicated quotation user; can view/update/delete showroom quotations.
- `admin`: can view/update/delete showroom quotations.
- `super_admin`: can view/update/delete showroom quotations.
- Normal `editor` / `viewer`: cannot see the Quotation Requests tab.

## Assign the designated user
Run once in Supabase SQL Editor, replacing the email:

```sql
update public.user_profiles
set role='quotation_manager', status='active'
where email='YOUR-DESIGNATED-EMPLOYEE-EMAIL'
  and account_type='employee';
```

Then run `supabase/showroom_quotation_authorization.sql`.
