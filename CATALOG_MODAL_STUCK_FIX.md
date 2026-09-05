# Catalog / Add Article Modal Stuck Fix

## Root cause
The General catalog component stays mounted while the app switches tabs (the parent uses `display:none`). Its ProductModal is rendered through a portal, so an open article modal could remain on top of Home/Add Product/other tabs. The catalog also persisted `selectedId` in sessionStorage, which restored the last opened article after a refresh.

## Fix
- Product modal, catalogue export, and scanner are rendered only while the Catalog tab is active.
- Catalog clears modal/scanner/export state whenever the Catalog tab becomes inactive.
- `selectedId` is no longer persisted/restored in catalog session state.
- Existing filter persistence is retained.
- Existing post-save auto-open behavior is retained; closing the product modal now stays closed and refreshes no longer resurrect it.
- ProductModal's existing body-scroll cleanup now runs normally when the modal unmounts, restoring page scrolling.

No database migration is required.
