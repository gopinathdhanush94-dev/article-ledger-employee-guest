/**
 * Restores the products table from a raw Supabase Table Editor CSV export
 * (Table Editor -> products -> Export data -> CSV) — this format includes
 * image_url directly, so images come back too, with no reconstruction needed.
 *
 * This is an INSERT-only script — it does not delete anything first. If a
 * row's EAN already exists in the table, that row is skipped (safe to run
 * even if the table isn't fully empty).
 *
 * Usage:
 *   npm run restore-products-backup
 *   npm run restore-products-backup -- path/to/other-backup.csv
 */
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
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

const csvPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'data', 'products_rows_backup.csv');

if (!fs.existsSync(csvPath)) {
  console.error(`\nCan't find file: ${csvPath}\n`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

let fileText = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const workbook = XLSX.read(fileText, { type: 'string', raw: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });

function normalizeKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[String(k).trim().toLowerCase()] = v;
  }
  return out;
}
const rows = rawRows.map(normalizeKeys);
console.log(`Loaded ${rows.length} rows from ${csvPath}`);

function clean(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') { const t = v.trim(); return t === '' ? null : t; }
  return v;
}
function num(v) { const c = clean(v); return c === null ? null : Number(c); }
function bool(v) {
  const c = clean(v);
  if (c === null) return false;
  return String(c).toUpperCase() === 'TRUE';
}
// The database requires ean to be exactly 13 digits, or null — anything else
// (blank, partial, non-numeric) must be normalized to null before insert, or
// a single bad row silently fails the *entire batch* it's inserted with.
function normalizeEan(v) {
  const c = clean(v);
  if (c === null) return null;
  const digits = String(c).replace(/\D/g, '');
  return /^\d{13}$/.test(digits) ? digits : null;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TEXT_FIELDS = ['month', 'category', 'brand', 'model', 'description', 'hsn', 'article_no',
  'marketed_by', 'image_url', 'sku_dim_unit', 'sku_wt_unit', 'master_dim_unit', 'master_wt_unit',
  'inner_dim_unit', 'inner_wt_unit'];
const NUMERIC_FIELDS = ['mrp', 'sp', 'master_qty', 'inner_qty', 'sku_l', 'sku_w', 'sku_h', 'sku_nw', 'sku_gw',
  'master_l', 'master_w', 'master_h', 'master_nw', 'master_gw', 'inner_l', 'inner_w', 'inner_h', 'inner_nw', 'inner_gw'];

async function main() {
  const { data: existingEanRows, error: existingErr } = await supabase.from('products').select('ean');
  if (existingErr) throw existingErr;
  const existingEans = new Set((existingEanRows || []).map(r => r.ean).filter(Boolean));
  console.log(`Products currently in database: (checking EANs) ${existingEans.size} distinct EANs found.`);

  let inserted = 0, skippedDup = 0, imagesRestored = 0, failed = 0;
  const CHUNK = 300;
  const toInsert = [];

  for (const r of rows) {
    const ean = normalizeEan(r.ean);
    if (ean && existingEans.has(ean)) { skippedDup++; continue; }
    if (ean) existingEans.add(ean); // guard against dup within this same file too

    const row = {};
    const id = clean(r.id);
    if (id && UUID_RE.test(id)) row.id = id;
    for (const f of TEXT_FIELDS) row[f] = clean(r[f]);
    for (const f of NUMERIC_FIELDS) row[f] = num(r[f]);
    row.ean = ean;
    row.custom = bool(r.custom);
    const createdAt = clean(r.created_at);
    const updatedAt = clean(r.updated_at);
    if (createdAt) row.created_at = createdAt;
    if (updatedAt) row.updated_at = updatedAt;

    if (row.image_url) imagesRestored++;
    toInsert.push(row);
  }

  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from('products').insert(chunk);
    if (!error) {
      inserted += chunk.length;
    } else {
      // A batch insert is all-or-nothing — if anything in this chunk is bad,
      // fall back to inserting one row at a time so the good rows still land
      // and we can report exactly which ones failed and why.
      console.warn(`  ! batch ${i}-${i + chunk.length} failed (${error.message}) — retrying rows individually...`);
      for (const row of chunk) {
        const { error: rowErr } = await supabase.from('products').insert(row);
        if (rowErr) {
          console.warn(`    ! row failed ("${row.description || row.ean || 'unknown'}"): ${rowErr.message}`);
          failed++;
        } else {
          inserted++;
        }
      }
    }
    console.log(`  ...${Math.min(i + CHUNK, toInsert.length)}/${toInsert.length} processed`);
  }

  console.log('\n---- Restore complete ----');
  console.log(`Inserted:            ${inserted}`);
  console.log(`With image restored: ${imagesRestored}`);
  console.log(`Skipped (duplicate): ${skippedDup}`);
  console.log(`Failed:              ${failed}`);
}

main().catch(err => {
  console.error('Restore failed:', err);
  process.exit(1);
});
