# Article Ledger — Final iOS / Android Modal Scroll Fix

## Updated files
- `src/components/ProductModal.jsx`
- `src/components/ScannerModal.jsx`
- `src/styles/theme.css`

## What this fixes
1. Locks the catalogue page while Product Details is open.
2. Preserves and restores the catalogue scroll position.
3. Prevents iOS Safari from scrolling the background document.
4. Makes the Product Details modal the only scrollable surface on mobile.
5. Prevents the catalogue/product cards from showing through the modal surface.
6. Keeps desktop product details viewport-fitted without adding a second scroll container.
7. Applies the same hard scroll isolation to the QR/barcode scanner.
8. Keeps the scanner's Not Available dialog above the scanner content.
9. Keeps camera auto-start behaviour and external-reader auto-focus behaviour from the existing scanner implementation.

## Important browser note
The native `BarcodeDetector` API is not available in every browser/version. The scanner therefore shows a clear fallback message when native camera decoding is unavailable. External USB/Bluetooth keyboard-wedge readers continue to work independently of `BarcodeDetector`.

## Install/deploy
Replace the three files in your existing project, then run:

```bash
npm install
npm run build
git add src/components/ProductModal.jsx src/components/ScannerModal.jsx src/styles/theme.css
git commit -m "Fix mobile modal scroll isolation and iOS rendering"
git push origin main
```

Vercel should deploy automatically from the pushed `main` branch.
