/**
 * One-time migration: loads the existing 651 products (and their images)
 * from scripts/data/products.json into your Supabase project.
 *
 * Usage:
 *   1. Copy .env.example to .env and fill in VITE_SUPABASE_URL and
 *      SUPABASE_SERVICE_ROLE_KEY (Project Settings -> API in Supabase).
 *   2. Run: npm run migrate
 *
 * Safe to re-run: it skips any EAN that's already in the database.
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
  console.error('\nMissing env vars. Copy .env.example to .env and fill in:');
  console.error('  VITE_SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const DATA_PATH = path.join(__dirname, 'data', 'products.json');
const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

console.log(`Loaded ${raw.length} products from ${DATA_PATH}`);

// ---- de-duplicate EANs (keep first occurrence, blank -> null) ----
const seenEan = new Set();
const rows = [];
let blankEan = 0, dupEan = 0;

for (const p of raw) {
  let ean = (p.ean || '').trim();
  if (!/^\d{13}$/.test(ean)) {
    ean = null;
    blankEan++;
  } else if (seenEan.has(ean)) {
    dupEan++;
    continue; // skip duplicate EAN, keep the first one seen
  } else {
    seenEan.add(ean);
  }

  rows.push({ ...p, ean, _image_data: p.image || null });
}

console.log(`After cleanup: ${rows.length} rows to import (${blankEan} with no/invalid EAN, ${dupEan} duplicate EANs skipped)`);

// ---- upload one image (data: URI) to storage, return public URL ----
async function uploadImage(dataUri, filename) {
  if (!dataUri || !dataUri.startsWith('data:')) return null;
  const match = dataUri.match(/^data:(.+);base64,(.*)$/);
  if (!match) return null;
  const [, mime, b64] = match;
  const buffer = Buffer.from(b64, 'base64');
  const { error } = await supabase.storage
    .from('product-images')
    .upload(filename, buffer, { contentType: mime, upsert: true });
  if (error) {
    console.warn(`  ! image upload failed for ${filename}: ${error.message}`);
    return null;
  }
  const { data } = supabase.storage.from('product-images').getPublicUrl(filename);
  return data.publicUrl;
}

async function main() {
  let inserted = 0, skippedExisting = 0, imagesUploaded = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const p = rows[i];

    if (p.ean) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('ean', p.ean)
        .maybeSingle();
      if (existing) { skippedExisting++; continue; }
    }

    let imageUrl = null;
    if (p._image_data) {
      const filename = `${p.id || 'item-' + i}.jpg`;
      imageUrl = await uploadImage(p._image_data, filename);
      if (imageUrl) imagesUploaded++;
    }

    const row = {
      month: p.month || null,
      category: p.category || 'Uncategorized',
      brand: p.brand || 'Unbranded',
      model: p.model || null,
      description: p.description || null,
      ean: p.ean,
      mrp: p.mrp,
      sp: p.sp,
      hsn: p.hsn || null,
      article_no: p.article_no || null,
      marketed_by: p.marketed_by || null,
      master_qty: p.master_qty,
      inner_qty: p.inner_qty,
      image_url: imageUrl,
      sku_l: p.sku_l, sku_w: p.sku_w, sku_h: p.sku_h,
      sku_dim_unit: p.sku_dim_unit,
      sku_nw: p.sku_nw, sku_gw: p.sku_gw,
      sku_wt_unit: p.sku_wt_unit,
      master_l: p.master_l, master_w: p.master_w, master_h: p.master_h,
      master_dim_unit: p.master_dim_unit,
      master_nw: p.master_nw, master_gw: p.master_gw,
      master_wt_unit: p.master_wt_unit,
      inner_l: p.inner_l, inner_w: p.inner_w, inner_h: p.inner_h,
      inner_dim_unit: p.inner_dim_unit,
      inner_nw: p.inner_nw, inner_gw: p.inner_gw,
      inner_wt_unit: p.inner_wt_unit,
      custom: false,
    };

    const { error } = await supabase.from('products').insert(row);
    if (error) {
      console.warn(`  ! insert failed for "${p.description || p.ean}": ${error.message}`);
      failed++;
    } else {
      inserted++;
    }

    if ((i + 1) % 25 === 0) {
      console.log(`  ...${i + 1}/${rows.length} processed`);
    }
  }

  console.log('\n---- Migration complete ----');
  console.log(`Inserted:          ${inserted}`);
  console.log(`Images uploaded:   ${imagesUploaded}`);
  console.log(`Already existed:   ${skippedExisting}`);
  console.log(`Failed:            ${failed}`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
