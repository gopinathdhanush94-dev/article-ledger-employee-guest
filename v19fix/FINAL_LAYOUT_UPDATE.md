# Article Ledger — Final Product Details Layout Update

This version updates the Product Details modal so the complete desktop layout fits inside the browser viewport without an internal vertical scrollbar.

## Included
- Large prominent selling price at top-right with safe spacing from close button.
- EAN / Article No. / PI Month / HSN in one row.
- Commercial section in one row.
- Master Carton: Quantity, Master Carton MRP, Dimensions, Net/Gross Weight.
- Inner Carton: Quantity, Inner Carton MRP, Dimensions, Net/Gross Weight.
- SKU / Unit Details.
- Carton MRP is calculated automatically as quantity × product MRP.
- Inner/master weight values wrap instead of being cut off.
- Action buttons remain visible at the bottom without the old white action bar.
- Desktop modal uses the available viewport height and removes the internal scroll for the normal desktop view.
- Mobile/tablet responsive behavior is retained.

## Replace
Replace these two files in the existing Article Ledger project:

src/components/ProductModal.jsx
src/styles/theme.css

## Build and deploy

npm install
npm run build

git add src/components/ProductModal.jsx src/styles/theme.css
git commit -m "Fix final product details viewport layout"
git push origin main

Then redeploy the same Vercel project/branch and hard refresh the browser (Ctrl+Shift+R).
