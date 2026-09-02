/**
 * One-time migration: loads the combined 2024 + 2025 general-article data
 * (from scripts/data/2024_2025/products.json) and the 2024 Pants garment data
 * (from scripts/data/2024_2025/garments.json) into your Supabase project.
 *
 * Duplicate protection: before inserting each row, this checks whether that
 * EAN already exists in the live database (regardless of when/how it got
 * there — the original Article_2026 import, a previous run of this script,
 * or manual entry) and skips it if so. Safe to re-run.
 *
 * Usage:
 *   npm run migrate-2024-2025
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
const DATA_DIR = path.join(__dirname, 'data', '2024_2025');

async function uploadImage(bucket, dataUri, filename) {
  if (!dataUri || !dataUri.startsWith('data:')) return null;
  const match = dataUri.match(/^data:(.+);base64,(.*)$/);
  if (!match) return null;
  const [, mime, b64] = match;
  const buffer = Buffer.from(b64, 'base64');
  const { error } = await supabase.storage.from(bucket).upload(filename, buffer, { contentType: mime, upsert: true });
  if (error) { console.warn(`  ! image upload failed for ${filename}: ${error.message}`); return null; }
  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}

function isValidEan(v) { return /^\d{13}$/.test(v || ''); }

// ============================================================
// PRODUCTS (general articles)
// ============================================================
async function migrateProducts() {
  const filePath = path.join(DATA_DIR, 'products.json');
  if (!fs.existsSync(filePath)) { console.log('No products.json found, skipping.'); return; }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`\n=== Products: loaded ${raw.length} rows ===`);

  let inserted = 0, skippedDup = 0, skippedNoEan = 0, imagesUploaded = 0, failed = 0;

  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    const ean = isValidEan(p.ean) ? p.ean : null;

    if (ean) {
      const { data: existing } = await supabase.from('products').select('id').eq('ean', ean).maybeSingle();
      if (existing) { skippedDup++; continue; }
    } else {
      // No usable EAN (e.g. Planters sheet) — still import, just can't dedupe on it.
      skippedNoEan++;
    }

    let imageUrl = null;
    if (p.image) {
      const filename = `2024-2025-${i}.jpg`;
      imageUrl = await uploadImage('product-images', p.image, filename);
      if (imageUrl) imagesUploaded++;
    }

    const row = {
      month: p.source || null,
      category: p.category, brand: p.brand, model: p.model, description: p.description,
      ean, mrp: p.mrp, sp: p.sp, hsn: p.hsn, article_no: p.article_no, marketed_by: p.marketed_by,
      master_qty: p.master_qty, inner_qty: p.inner_qty,
      sku_l: p.sku_l, sku_w: p.sku_w, sku_h: p.sku_h, sku_dim_unit: p.sku_dim_unit,
      sku_nw: p.sku_nw, sku_gw: p.sku_gw, sku_wt_unit: p.sku_wt_unit,
      master_l: p.master_l, master_w: p.master_w, master_h: p.master_h, master_dim_unit: p.master_dim_unit,
      master_nw: p.master_nw, master_gw: p.master_gw, master_wt_unit: p.master_wt_unit,
      inner_l: p.inner_l, inner_w: p.inner_w, inner_h: p.inner_h, inner_dim_unit: p.inner_dim_unit,
      inner_nw: p.inner_nw, inner_gw: p.inner_gw, inner_wt_unit: p.inner_wt_unit,
      image_url: imageUrl,
      custom: false,
    };

    const { error } = await supabase.from('products').insert(row);
    if (error) { console.warn(`  ! insert failed for "${p.description || ean}": ${error.message}`); failed++; }
    else inserted++;

    if ((i + 1) % 50 === 0) console.log(`  ...${i + 1}/${raw.length} processed`);
  }

  console.log('\n---- Products migration complete ----');
  console.log(`Inserted:              ${inserted}`);
  console.log(`Images uploaded:       ${imagesUploaded}`);
  console.log(`Skipped (duplicate):   ${skippedDup}`);
  console.log(`Imported w/o EAN:      ${skippedNoEan} (no EAN in source, kept anyway)`);
  console.log(`Failed:                ${failed}`);
}

// ============================================================
// GARMENTS (2024 Pants sheet)
// ============================================================
async function migrateGarments() {
  const filePath = path.join(DATA_DIR, 'garments.json');
  if (!fs.existsSync(filePath)) { console.log('No garments.json found, skipping.'); return; }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`\n=== Garments: loaded ${raw.length} rows ===`);

  let inserted = 0, skippedDup = 0, imagesUploaded = 0, failed = 0;

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const ean = r.ean || null;

    if (ean) {
      const { data: existing } = await supabase.from('garments').select('id').eq('ean', ean).maybeSingle();
      if (existing) { skippedDup++; continue; }
    }

    let imageUrl = null;
    if (r.image) {
      const filename = `2024-2025-garm-${i}.jpg`;
      imageUrl = await uploadImage('garment-images', r.image, filename);
      if (imageUrl) imagesUploaded++;
    }

    const row = {
      source_file: r.source_file, sheet: r.sheet, excel_name: r.excel_name, model_name: r.model_name,
      model1: r.model1, brand: r.brand, description: r.description, color: r.color,
      customer_model: r.customer_model, origin: r.origin, moi: r.moi, mfd: r.mfd,
      size: r.size, ratio: r.ratio, bottom_met_size: r.bottom_met_size, top_met_size: r.top_met_size,
      master_ean: r.master_ean, master_article: r.master_article, ean, article: r.article, ctn_no: r.ctn_no,
      mrp: r.mrp, rrp: r.rrp, image_url: imageUrl, custom: false,
    };

    const { error } = await supabase.from('garments').insert(row);
    if (error) { console.warn(`  ! insert failed for "${r.excel_name || ''} / ${r.color || ''}": ${error.message}`); failed++; }
    else inserted++;
  }

  console.log('\n---- Garments migration complete ----');
  console.log(`Inserted:              ${inserted}`);
  console.log(`Images uploaded:       ${imagesUploaded}`);
  console.log(`Skipped (duplicate):   ${skippedDup}`);
  console.log(`Failed:                ${failed}`);
}

async function main() {
  await migrateProducts();
  await migrateGarments();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
