# Gemini Image Studio

Article Ledger includes an employee-only AI Image Studio for testing product-image enhancement.

## Vercel setup

Set this server-side environment variable in Vercel:

`GEMINI_API_KEY`

Do not use a `VITE_` prefix and do not expose the key in browser code.

The API endpoint is:

`POST /api/gemini-enhance-image`

The endpoint fetches the selected public Supabase image server-side and sends it to Gemini 3 Pro Image. It returns the generated image directly to the browser.

## First test

Open Article Ledger as an employee with edit permission and choose **AI Image Studio**.

Select up to 10 images and run the test. Originals are not modified or uploaded over.

The enhancement prompt is deliberately conservative: preserve product identity, geometry, colour, labels and physical details; restore presentation quality; use a clean white studio background; do not invent or redesign the product.

## Notes

- The current test uses Gemini 3 Pro Image at 2K output.
- Generated results are browser previews only; there is no automatic replacement of Supabase originals.
- Review the 10-image test before adding any bulk replacement/upload workflow.
