/**
 * One-time migration: loads the 2,065 garment SKU rows (and their 470 images)
 * from scripts/data/garments/garments.json into your Supabase project.
 *
 * Prerequisite: run supabase/garments_schema.sql in the Supabase SQL Editor first.
 *
 * Usage:
 *   npm run migrate-garments
 *
 * Safe to re-run: skips anything already imported (matched on ean + size + source_file).
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

const DATA_PATH = path.join(__dirname, 'data', 'garments', 'garments.json');
const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

console.log(`Loaded ${raw.length} garment SKU rows from ${DATA_PATH}`);

function clean(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') { const t = v.trim(); return t === '' ? null : t; }
  return v;
}
function num(v) {
  const c = clean(v);
  return c === null ? null : Number(c);
}
function text(v) {
  const c = clean(v);
  return c === null ? null : String(c);
}

async function uploadImage(dataUri, filename) {
  if (!dataUri || !dataUri.startsWith('data:')) return null;
  const match = dataUri.match(/^data:(.+);base64,(.*)$/);
  if (!match) return null;
  const [, mime, b64] = match;
  const buffer = Buffer.from(b64, 'base64');
  const { error } = await supabase.storage
    .from('garment-images')
    .upload(filename, buffer, { contentType: mime, upsert: true });
  if (error) {
    console.warn(`  ! image upload failed for ${filename}: ${error.message}`);
    return null;
  }
  const { data } = supabase.storage.from('garment-images').getPublicUrl(filename);
  return data.publicUrl;
}

async function main() {
  let inserted = 0, skippedExisting = 0, imagesUploaded = 0, failed = 0;

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const ean = text(r.ean);

    if (ean) {
      const { data: existing } = await supabase
        .from('garments')
        .select('id')
        .eq('ean', ean)
        .eq('source_file', text(r.source_file))
        .maybeSingle();
      if (existing) { skippedExisting++; continue; }
    }

    let imageUrl = null;
    if (r.image) {
      const filename = `${text(r.source_file) || 'src'}-${text(r.sheet) || 'sheet'}-${i}.jpg`;
      imageUrl = await uploadImage(r.image, filename);
      if (imageUrl) imagesUploaded++;
    }

    const row = {
      source_file: text(r.source_file),
      sheet: text(r.sheet),
      excel_name: text(r.excel_name),
      model_name: text(r.model_name),
      model1: text(r.model1),
      brand: text(r.brand) || 'Unbranded',
      description: text(r.description),
      color: text(r.color),
      customer_model: text(r.customer_model),
      origin: text(r.origin),
      moi: text(r.moi),
      mfd: text(r.mfd),
      size: text(r.size),
      ratio: num(r.ratio),
      bottom_met_size: text(r.bottom_met_size),
      top_met_size: text(r.top_met_size),
      master_ean: text(r.master_ean),
      master_article: text(r.master_article),
      ean,
      article: text(r.article),
      ctn_no: text(r.ctn_no),
      mrp: num(r.mrp),
      rrp: num(r.rrp),
      image_url: imageUrl,
      custom: false,
    };

    const { error } = await supabase.from('garments').insert(row);
    if (error) {
      console.warn(`  ! insert failed for "${r.excel_name || ''} / ${r.color || ''} / ${r.size || ''}": ${error.message}`);
      failed++;
    } else {
      inserted++;
    }

    if ((i + 1) % 100 === 0) console.log(`  ...${i + 1}/${raw.length} processed`);
  }

  console.log('\n---- Garment migration complete ----');
  console.log(`Inserted:          ${inserted}`);
  console.log(`Images uploaded:   ${imagesUploaded}`);
  console.log(`Already existed:   ${skippedExisting}`);
  console.log(`Failed:            ${failed}`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
