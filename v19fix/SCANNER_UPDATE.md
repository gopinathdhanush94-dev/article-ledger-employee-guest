# QR / Barcode Search Update

Added a scanner button inside the General Article search field.

## Mobile
- Opens a Camera / QR / Barcode scanner.
- Uses the rear camera (`facingMode: environment`).
- Uses the browser BarcodeDetector API with common QR/barcode formats.
- After a successful scan, the matching article opens immediately in Product Details.

## Desktop / Laptop
- Opens an External Reader mode by default.
- USB/Bluetooth barcode readers that behave like a keyboard work directly.
- Scan the barcode while the field is focused; the scanner's Enter key submits the lookup.
- The matching article opens immediately.

## Matching
The scanned value is matched against:
- EAN
- Article No.
- Model
- HSN
- Product ID

If a QR contains a URL or surrounding text, the scanner also attempts to extract an 8–14 digit EAN token.

No database/schema changes are required.
