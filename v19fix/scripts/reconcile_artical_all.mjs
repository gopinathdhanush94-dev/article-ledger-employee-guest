/**
 * Reconciles the live products table against the deduplicated master file
 * (scripts/data/artical_all/data.json, 1,389 records: 1,375 with a valid EAN
 * + 14 with no EAN at all).
 *
 * By default this only REPORTS — it changes nothing. Two optional flags let
 * you act on what it finds:
 *
 *   npm run reconcile-artical-all
 *     -> just prints the report
 *
 *   npm run reconcile-artical-all -- --add-missing-no-ean
 *     -> also inserts the 14 file records that have no EAN (these were
 *        skipped entirely by the original sync, since there's no EAN to
 *        match/update against)
 *
 *   npm run reconcile-artical-all -- --prune-extras
 *     -> also DELETES any product in the database whose EAN is not present
 *        anywhere in the master file. Products with no EAN at all in the
 *        database are never touched by this, since there's no way to know
 *        if they're legitimately unrelated to this file.
 *
 * Flags can be combined: --add-missing-no-ean --prune-extras
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\nMissing env vars. Make sure .env has VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const args = process.argv.slice(2);
const doAddMissing = args.includes('--add-missing-no-ean');
const doPrune = args.includes('--prune-extras');

const DATA_PATH = path.join(__dirname, 'data', 'artical_all', 'data.json');
const fileRecords = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

function normalizeEan(v) {
  if (!v) return null;
  const digits = String(v).replace(/\D/g, '');
  return /^\d{13}$/.test(digits) ? digits : null;
}

async function fetchAllProducts() {
  const pageSize = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('products').select('id, ean').range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function uploadImage(dataUri, filename) {
  if (!dataUri || !dataUri.startsWith('data:')) return null;
  const match = dataUri.match(/^data:(.+);base64,(.*)$/);
  if (!match) return null;
  const [, mime, b64] = match;
  const buffer = Buffer.from(b64, 'base64');
  const { error } = await supabase.storage.from('product-images').upload(filename, buffer, { contentType: mime, upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from('product-images').getPublicUrl(filename);
  return data.publicUrl;
}

async function main() {
  const fileEans = new Set(fileRecords.map(r => normalizeEan(r.ean)).filter(Boolean));
  const fileNoEan = fileRecords.filter(r => !normalizeEan(r.ean));

  const dbProducts = await fetchAllProducts();
  const dbWithEan = dbProducts.filter(p => p.ean);
  const dbNoEan = dbProducts.filter(p => !p.ean);
  const dbExtras = dbWithEan.filter(p => !fileEans.has(p.ean));
  const dbMatched = dbWithEan.filter(p => fileEans.has(p.ean));

  console.log('---- Reconciliation report ----');
  console.log(`Products in database:                 ${dbProducts.length}`);
  console.log(`  with EAN matching the file:          ${dbMatched.length}`);
  console.log(`  with EAN NOT in the file (extras):   ${dbExtras.length}`);
  console.log(`  with no EAN at all (never touched):  ${dbNoEan.length}`);
  console.log(`File records with a valid EAN:          ${fileEans.size}`);
  console.log(`File records with NO EAN (not synced):  ${fileNoEan.length}`);
  console.log('');

  if (!doAddMissing && !doPrune) {
    console.log('This was a report only — nothing has been changed.');
    if (dbExtras.length > 0) {
      console.log(`\nTo remove the ${dbExtras.length} extra database products not in the file, re-run with --prune-extras`);
    }
    if (fileNoEan.length > 0) {
      console.log(`To insert the ${fileNoEan.length} file records that have no EAN, re-run with --add-missing-no-ean`);
    }
    return;
  }

  if (doAddMissing && fileNoEan.length > 0) {
    console.log(`Inserting ${fileNoEan.length} no-EAN records from the file...`);
    let inserted = 0, failed = 0;
    for (const r of fileNoEan) {
      let imageUrl = null;
      if (r.image) imageUrl = await uploadImage(r.image, `artical-all-noean-${inserted}-${failed}.jpg`);
      const { error } = await supabase.from('products').insert({
        category: r.category, brand: r.brand, description: r.description, ean: null,
        mrp: r.mrp, sp: r.sp, hsn: r.hsn, article_no: r.article_no,
        master_qty: r.master_qty, inner_qty: r.inner_qty,
        master_l: r.master_l, master_w: r.master_w, master_h: r.master_h, master_dim_unit: r.master_dim_unit,
        master_nw: r.master_nw, master_gw: r.master_gw,
        inner_l: r.inner_l, inner_w: r.inner_w, inner_h: r.inner_h, inner_dim_unit: r.inner_dim_unit,
        inner_nw: r.inner_nw, inner_gw: r.inner_gw,
        month: r.year, image_url: imageUrl, custom: false,
      });
      if (error) failed++; else inserted++;
    }
    console.log(`  Inserted: ${inserted}, Failed: ${failed}\n`);
  }

  if (doPrune && dbExtras.length > 0) {
    console.log(`Deleting ${dbExtras.length} database products whose EAN is not in the file...`);
    const ids = dbExtras.map(p => p.id);
    const CHUNK = 300;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { error } = await supabase.from('products').delete().in('id', chunk);
      if (!error) deleted += chunk.length;
      else console.warn(`  ! failed to delete batch: ${error.message}`);
    }
    console.log(`  Deleted: ${deleted}\n`);
  }

  console.log('Done. Run without flags again to see the updated report.');
}

main().catch(err => {
  console.error('Reconcile failed:', err);
  process.exit(1);
});
