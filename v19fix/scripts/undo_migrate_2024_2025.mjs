/**
 * Removes exactly the rows inserted by scripts/migrate_2024_2025.mjs, identified
 * by the source markers that migration stamped on them (products.month and
 * garments.source_file). Does not touch your original Article_2026 data, the
 * earlier garment files, or anything added/edited manually through the app.
 *
 * Usage:
 *   npm run undo-2024-2025
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\nMissing env vars. Make sure .env has VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const PRODUCT_SOURCE_MARKERS = [
  '2024_Articles', '2024_Baskets', '2024_Travel Pouch', '2024_Planters',
  '2024_Taiqian', '2024_Wallet', '2024_Staplers', '2024_Caps',
  '2025_JAN_JUN_25', '2025_JUL_AUG_25', '2025_SEP_25', '2025_OCT_25', '2025_NOV_25',
];
const GARMENT_SOURCE_MARKER = '2024_PANTS';

async function main() {
  const { data: prodMatches, error: prodSelErr } = await supabase
    .from('products').select('id').in('month', PRODUCT_SOURCE_MARKERS);
  if (prodSelErr) throw prodSelErr;
  console.log(`Found ${prodMatches.length} products from the 2024/2025 batch.`);

  const { data: garmMatches, error: garmSelErr } = await supabase
    .from('garments').select('id').eq('source_file', GARMENT_SOURCE_MARKER);
  if (garmSelErr) throw garmSelErr;
  console.log(`Found ${garmMatches.length} garments from the 2024/2025 batch.`);

  if (prodMatches.length === 0 && garmMatches.length === 0) {
    console.log('\nNothing to undo — no matching rows found.');
    return;
  }

  if (prodMatches.length > 0) {
    const { error } = await supabase.from('products').delete().in('month', PRODUCT_SOURCE_MARKERS);
    if (error) throw error;
    console.log(`Deleted ${prodMatches.length} products.`);
  }

  if (garmMatches.length > 0) {
    const { error } = await supabase.from('garments').delete().eq('source_file', GARMENT_SOURCE_MARKER);
    if (error) throw error;
    console.log(`Deleted ${garmMatches.length} garments.`);
  }

  console.log('\nDone. Your original data (pre-2024/2025 batch) is untouched.');
  console.log('Note: uploaded images for the deleted rows still exist in Storage');
  console.log('(product-images / garment-images buckets) — harmless, just unused');
  console.log('space. Delete manually there if you want to fully clean up.');
}

main().catch(err => {
  console.error('Undo failed:', err);
  process.exit(1);
});
