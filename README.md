# Article Ledger — Employee / Guest Entry Flow

This is a source patch for the existing Article Ledger project.

## Replace
- `src/App.jsx`
- `src/lib/useAuth.js`
- Add `src/components/AccessGate.jsx`
- Append the supplied CSS block from `theme-access-gate.css` to `src/styles/theme.css`

## Behavior
1. App opens on a role-selection screen: Employee or Guest.
2. Both roles must sign in or create an account.
3. Employee accounts open the existing internal Article Ledger after authentication.
4. Guest accounts do NOT open the internal Article Ledger; they land on a temporary guest-ready screen until the showroom experience is implemented.
5. Employee signups store role metadata `employee`; guest signups store role metadata `guest`.

## Important security note
This is the first-stage UI/authentication gate only. Before exposing guest showroom data, create a server-side role/profile table and Supabase RLS policies. Do not use user metadata alone as the security boundary for internal data.

## Quotation email policy
Quotation requests are handled entirely inside the webapp. No automatic quotation email is sent. Employees download the final quotation PDF from Employee Access and share it manually.
