/**
 * Removes the original garments upload from the four source files
 * (2026 OUTSTITCH, 2025 LIVESMEART, 2026 LIVEPLUS, 2026 LIVESMEART — 2,065 rows).
 * Does not touch the 2024 Pants garment batch (if separately imported) or
 * anything added/edited manually through the app.
 *
 * Usage:
 *   npm run undo-original-garments
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

const SOURCE_MARKERS = ['2026_OUTSTITCH', '2025_LIVESMEART', '2026_LIVEPLUS', '2026_LIVESMEART'];

async function main() {
  const { data: matches, error: selErr } = await supabase
    .from('garments').select('id, source_file').in('source_file', SOURCE_MARKERS);
  if (selErr) throw selErr;

  console.log(`Found ${matches.length} garments from the original 4-file upload.`);
  const bySource = {};
  matches.forEach(m => { bySource[m.source_file] = (bySource[m.source_file] || 0) + 1; });
  Object.entries(bySource).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  if (matches.length === 0) {
    console.log('\nNothing to undo — no matching rows found.');
    return;
  }

  const { error } = await supabase.from('garments').delete().in('source_file', SOURCE_MARKERS);
  if (error) throw error;

  console.log(`\nDeleted ${matches.length} garments.`);
  console.log('Note: uploaded images for the deleted rows still exist in the');
  console.log('garment-images Storage bucket — harmless, just unused space.');
}

main().catch(err => {
  console.error('Undo failed:', err);
  process.exit(1);
});
