/**
 * Syncs the deduplicated ARTICAL_ALL.xlsx dataset (scripts/data/artical_all/data.json)
 * into the live products table:
 *
 *   - EAN already exists in the database  -> UPDATE that row with the fresh
 *     data. If this record has an image, it replaces whatever image was
 *     there before (the file's image is treated as the most up-to-date).
 *     If this record has NO image, the existing database image (if any) is
 *     left untouched rather than being wiped out.
 *   - EAN not in the database yet         -> INSERT as a new row.
 *
 * This is the "enhance" + "sync" step: the JSON going in has already been
 * deduplicated across the 2024/2025/2026 sheets (latest year wins, with the
 * best available image pulled in from an older year when the latest year's
 * own row didn't have one).
 *
 * Usage:
 *   npm run sync-artical-all
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

const DATA_PATH = path.join(__dirname, 'data', 'artical_all', 'data.json');
const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
console.log(`Loaded ${raw.length} deduplicated records from ${DATA_PATH}`);

function normalizeEan(v) {
  if (!v) return null;
  const digits = String(v).replace(/\D/g, '');
  return /^\d{13}$/.test(digits) ? digits : null;
}

async function uploadImage(dataUri, filename) {
  if (!dataUri || !dataUri.startsWith('data:')) return null;
  const match = dataUri.match(/^data:(.+);base64,(.*)$/);
  if (!match) return null;
  const [, mime, b64] = match;
  const buffer = Buffer.from(b64, 'base64');
  const { error } = await supabase.storage.from('product-images').upload(filename, buffer, { contentType: mime, upsert: true });
  if (error) { console.warn(`  ! image upload failed for ${filename}: ${error.message}`); return null; }
  const { data } = supabase.storage.from('product-images').getPublicUrl(filename);
  return data.publicUrl;
}

// Supabase caps a single select() response at 1000 rows by default, no
// matter how many rows actually exist — page through with .range() so we
// see every existing product, not just the first 1000.
async function fetchAllExistingProducts() {
  const pageSize = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('products').select('id, ean, image_url').range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  const existingRows = await fetchAllExistingProducts();
  const existingByEan = new Map();
  (existingRows || []).forEach(r => { if (r.ean) existingByEan.set(r.ean, r); });
  console.log(`Products currently in database: ${existingRows.length} (${existingByEan.size} with a usable EAN)\n`);

  let updated = 0, inserted = 0, imageAdded = 0, imageKeptExisting = 0, imageUnchangedNone = 0, skippedNoEan = 0, failed = 0;

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const ean = normalizeEan(r.ean);
    if (!ean) { skippedNoEan++; continue; }

    const existing = existingByEan.get(ean);
    let imageUrl = existing ? existing.image_url : null;

    if (r.image) {
      const filename = `artical-all-${ean}.jpg`;
      const uploaded = await uploadImage(r.image, filename);
      if (uploaded) { imageUrl = uploaded; imageAdded++; }
    } else if (existing && existing.image_url) {
      imageKeptExisting++;
    } else {
      imageUnchangedNone++;
    }

    const fields = {
      category: r.category, brand: r.brand, description: r.description,
      ean, mrp: r.mrp, sp: r.sp, hsn: r.hsn, article_no: r.article_no,
      master_qty: r.master_qty, inner_qty: r.inner_qty,
      master_l: r.master_l, master_w: r.master_w, master_h: r.master_h, master_dim_unit: r.master_dim_unit,
      master_nw: r.master_nw, master_gw: r.master_gw,
      inner_l: r.inner_l, inner_w: r.inner_w, inner_h: r.inner_h, inner_dim_unit: r.inner_dim_unit,
      inner_nw: r.inner_nw, inner_gw: r.inner_gw,
      month: r.year, image_url: imageUrl,
    };

    if (existing) {
      const { error } = await supabase.from('products').update(fields).eq('id', existing.id);
      if (error) { console.warn(`  ! update failed for EAN ${ean}: ${error.message}`); failed++; }
      else updated++;
    } else {
      const { error } = await supabase.from('products').insert({ ...fields, custom: false });
      if (error) { console.warn(`  ! insert failed for EAN ${ean}: ${error.message}`); failed++; }
      else inserted++;
    }

    if ((i + 1) % 100 === 0) console.log(`  ...${i + 1}/${raw.length} processed`);
  }

  console.log('\n---- Sync complete ----');
  console.log(`Updated (existing EAN):        ${updated}`);
  console.log(`Inserted (new EAN):             ${inserted}`);
  console.log(`Image added/replaced:           ${imageAdded}`);
  console.log(`Image kept from existing DB row: ${imageKeptExisting}`);
  console.log(`No image available at all:      ${imageUnchangedNone}`);
  console.log(`Skipped (no valid EAN):          ${skippedNoEan}`);
  console.log(`Failed:                          ${failed}`);
}

main().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
