/**
 * One-time cleanup: re-normalizes the "month" value on every existing product
 * so that records representing the same month (however they were originally
 * typed — "Jul-26", "Jul 2026", "jul26", etc.) all end up with the exact same
 * stored value going forward. This merges what currently look like duplicate
 * entries in the Month filter/chart into one.
 *
 * Uses the exact same normalizeMonthValue() function the app itself uses for
 * new entries, so there's no risk of this script and the app disagreeing on
 * what "canonical" means.
 *
 * Usage:
 *   npm run normalize-months
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { normalizeMonthValue } from '../src/lib/helpers.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\nMissing env vars. Make sure .env has VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function fetchAllProducts() {
  const pageSize = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('products').select('id, month').range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  const products = await fetchAllProducts();
  console.log(`Checking ${products.length} products...`);

  const changes = [];
  for (const p of products) {
    const normalized = normalizeMonthValue(p.month);
    if (normalized !== p.month) {
      changes.push({ id: p.id, old: p.month, normalized });
    }
  }

  if (changes.length === 0) {
    console.log('\nNothing to fix — every month value is already consistent.');
    return;
  }

  console.log(`\nFound ${changes.length} products with a month value that needs normalizing:`);
  const grouped = {};
  changes.forEach(c => {
    const key = `${c.old} -> ${c.normalized}`;
    grouped[key] = (grouped[key] || 0) + 1;
  });
  Object.entries(grouped).forEach(([k, count]) => console.log(`  ${k}  (${count} product${count === 1 ? '' : 's'})`));

  let updated = 0, failed = 0;
  for (const c of changes) {
    const { error } = await supabase.from('products').update({ month: c.normalized }).eq('id', c.id);
    if (error) { console.warn(`  ! failed to update ${c.id}: ${error.message}`); failed++; }
    else updated++;
  }

  console.log('\n---- Normalization complete ----');
  console.log(`Updated: ${updated}`);
  console.log(`Failed:  ${failed}`);
  console.log('\nRefresh the app — the Month filter and chart should now show one merged entry per month.');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
