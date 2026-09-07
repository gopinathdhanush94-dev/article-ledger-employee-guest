# Article Ledger UI/UX Refresh

## Scope
- Premium responsive visual system for Employee and Guest experiences.
- Refreshed main role-selection/login experience.
- Improved headers, tabs, controls, cards, forms, modals and mobile layouts.
- Added viewport-safe modal sizing and overflow protection.
- Added IndexedDB caching for employee products/garments so repeat opens can render the last successful dataset immediately, followed by background refresh.
- Added persistent lightweight Guest showroom caching in localStorage with background revalidation.
- Employee garment loading is deferred slightly behind the primary product dataset to prioritize the first screen.

## Data safety
- No database schema changes.
- No permissions changes.
- Cache is a performance layer only; Supabase remains the source of truth.
- Cached data is revalidated against Supabase in the background.

## UI rules
- No horizontal page overflow.
- Modals are constrained to the viewport and scroll internally.
- Responsive layouts collapse before content can overlap.
- Reduced-motion preference is respected.
