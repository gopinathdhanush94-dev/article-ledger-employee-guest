# Tab/session persistence fix

## Root cause

The app previously created two independent `useAuth()` instances: one in `AccessGate` and another in `AppInner`. Each instance registered its own Supabase `onAuthStateChange` listener. When the browser returned to an existing tab, Supabase could emit `SIGNED_IN`/`TOKEN_REFRESHED` for the already-authenticated session. The auth hook could then set its loading state and cause `AccessGate` to unmount `AppInner`, destroying the current React view and making the app appear to refresh back to Home.

## Permanent fix

- Added a single `AuthProvider` around the application.
- `AccessGate`, `AppInner`, `GuestShowroom`, and login UI now consume the same auth state/context.
- `TOKEN_REFRESHED` never enters the access-gate loading state.
- A duplicate `SIGNED_IN` for the same user never enters the loading state or reloads the profile.
- Only the initial session, a genuine user change, or a sign-in for a different user blocks the gate while the profile is hydrated.
- Profile requests are guarded against stale async responses.
- The active route remains in React state and is additionally protected by the URL hash/sessionStorage logic already present in the app.

## Showroom persistence hardening

Guest showroom localStorage is now namespaced by Supabase user ID:

- favourites
- cart
- cart quantities
- quotation comments
- required dates
- quotation preview state

This prevents one browser user from inheriting another user's unfinished showroom selection.

## Expected behaviour

Switching to another browser tab and returning to Article Ledger should keep the current page/view mounted. It should not show `Checking your access…`, should not fall back to Home, and should not reload the catalogue merely because Supabase refreshed or re-announced the existing session.
