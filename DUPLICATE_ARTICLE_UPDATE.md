# Duplicate Article

Added a Duplicate Article action to the General Article detail modal for users who have Add Product permission.

## Behavior
- Copies the complete existing article form data into a new Add Article form.
- Clears the database `id` so a new row is created.
- Clears the EAN because EAN is unique and must be entered for the new article.
- Preserves the image URL and all other article fields so users can change only what differs (for example colour/model/description/article number) before saving.
- Uses the existing Add Article validation, EAN uniqueness check, confirmation, audit/change-reason flow, and save logic.
- No database migration is required.

## Existing functionality
No changes to QR/barcode scanning, product details, image viewer, garments, showroom, favourites, cart, quotations, roles, permissions, or existing edit/delete behavior.
