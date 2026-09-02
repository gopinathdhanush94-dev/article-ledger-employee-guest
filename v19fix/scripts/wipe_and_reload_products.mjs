/**
 * DESTRUCTIVE: deletes every row in the "products" table, then reloads it
 * fresh from a CSV export (like scripts/data/products-edited.csv).
 *
 * IMPORTANT: the CSV export from the app's "Download filtered (.xlsx)" button
 * does not include product images, so every product loses its photo when
 * this runs. There is no automatic way to restore images after this — only
 * run this if that trade-off is genuinely intended.
 *
 * This will NOT run without an explicit confirmation flag, to prevent an
 * accidental total wipe:
 *
 *   npm run wipe-and-reload-products -- --yes-delete-everything scripts/data/products-edited.csv
 *
 * (the CSV path defaults to scripts/data/products-edited.csv if omitted)
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

const args = process.argv.slice(2);
const confirmed = args.includes('--yes-delete-everything');
const csvArg = args.find(a => !a.startsWith('--'));
const csvPath = csvArg ? path.resolve(csvArg) : path.join(__dirname, 'data', 'products-edited.csv');

if (!fs.existsSync(csvPath)) {
  console.error(`\nCan't find file: ${csvPath}\n`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const HEADER_ALIASES = {
  'article no': 'article_no', 'marketed by': 'marketed_by',
  'master qty': 'master_qty', 'inner qty': 'inner_qty',
  'sku l': 'sku_l', 'sku w': 'sku_w', 'sku h': 'sku_h',
  'sku dim unit': 'sku_dim_unit', 'sku net wt': 'sku_nw', 'sku gross wt': 'sku_gw', 'sku weight unit': 'sku_wt_unit',
  'master l': 'master_l', 'master w': 'master_w', 'master h': 'master_h',
  'master dim unit': 'master_dim_unit', 'master net wt': 'master_nw', 'master gross wt': 'master_gw', 'master weight unit': 'master_wt_unit',
  'inner l': 'inner_l', 'inner w': 'inner_w', 'inner h': 'inner_h',
  'inner dim unit': 'inner_dim_unit', 'inner net wt': 'inner_nw', 'inner gross wt': 'inner_gw', 'inner weight unit': 'inner_wt_unit',
};

let fileText = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const workbook = XLSX.read(fileText, { type: 'string', raw: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });

function normalizeKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    let key = String(k).trim().toLowerCase();
    key = HEADER_ALIASES[key] || key;
    out[key] = v;
  }
  return out;
}
const rows = rawRows.map(normalizeKeys);

function clean(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') { const t = v.trim(); return t === '' ? null : t; }
  return v;
}
function num(v) { const c = clean(v); return c === null ? null : Number(c); }
function normalizeEan(v) {
  const c = clean(v);
  if (c === null) return null;
  const digits = String(c).replace(/\D/g, '');
  return /^\d{13}$/.test(digits) ? digits : null;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toInsert = rows.map(r => {
  const row = {
    category: clean(r.category) || 'Uncategorized',
    brand: clean(r.brand) || 'Unbranded',
    model: clean(r.model), description: clean(r.description),
    ean: normalizeEan(r.ean),
    mrp: num(r.mrp), sp: num(r.sp), hsn: clean(r.hsn),
    article_no: clean(r.article_no), marketed_by: clean(r.marketed_by),
    month: clean(r.month),
    master_qty: num(r.master_qty), inner_qty: num(r.inner_qty),
    sku_l: num(r.sku_l), sku_w: num(r.sku_w), sku_h: num(r.sku_h), sku_dim_unit: clean(r.sku_dim_unit),
    sku_nw: num(r.sku_nw), sku_gw: num(r.sku_gw), sku_wt_unit: clean(r.sku_wt_unit),
    master_l: num(r.master_l), master_w: num(r.master_w), master_h: num(r.master_h), master_dim_unit: clean(r.master_dim_unit),
    master_nw: num(r.master_nw), master_gw: num(r.master_gw), master_wt_unit: clean(r.master_wt_unit),
    inner_l: num(r.inner_l), inner_w: num(r.inner_w), inner_h: num(r.inner_h), inner_dim_unit: clean(r.inner_dim_unit),
    inner_nw: num(r.inner_nw), inner_gw: num(r.inner_gw), inner_wt_unit: clean(r.inner_wt_unit),
    image_url: null,
    custom: false,
  };
  const id = clean(r.id);
  if (id && UUID_RE.test(id)) row.id = id; // preserve original id where valid; otherwise let the DB generate one
  return row;
});

async function main() {
  const { count: existingCount, error: countErr } = await supabase.from('products').select('*', { count: 'exact', head: true });
  if (countErr) throw countErr;

  console.log(`Current products in database: ${existingCount}`);
  console.log(`Rows loaded from CSV, ready to insert: ${toInsert.length}`);
  console.log('\nThis will PERMANENTLY DELETE all current products and replace them with the CSV rows above.');
  console.log('All product images will be lost (this CSV does not contain image data).\n');

  if (!confirmed) {
    console.log('Nothing has been changed. To actually run this, re-run with the confirmation flag:');
    console.log('  npm run wipe-and-reload-products -- --yes-delete-everything\n');
    return;
  }

  console.log('Confirmation flag present — proceeding.\n');

  const { error: delErr } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) throw delErr;
  console.log(`Deleted all ${existingCount} existing products.`);

  let inserted = 0, failed = 0;
  const CHUNK = 300;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from('products').insert(chunk);
    if (error) { console.warn(`  ! batch ${i}-${i + chunk.length} failed: ${error.message}`); failed += chunk.length; }
    else inserted += chunk.length;
  }

  console.log('\n---- Wipe and reload complete ----');
  console.log(`Deleted:  ${existingCount}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Failed:   ${failed}`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
