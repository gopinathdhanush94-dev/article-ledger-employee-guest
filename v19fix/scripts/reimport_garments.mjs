/**
 * Re-imports an edited CSV export back into the garments table, UPDATING
 * existing rows by matching on their "id" column (does not create new rows
 * or duplicates).
 *
 * Workflow:
 *   1. In Supabase: Table Editor -> garments -> (top-right ⋯ menu) -> Export data -> CSV
 *   2. Open that CSV in Excel, fix spellings/colors/etc. DO NOT touch or delete the "id" column
 *      (that's how this script knows which row to update). DO NOT touch "image_url" unless
 *      you're intentionally replacing a photo.
 *   3. Save it as CSV, and put the file at: scripts/data/garments-edited.csv
 *      (or pass a different path as an argument, see below)
 *   4. Run:  npm run reimport-garments
 *      or:   npm run reimport-garments -- path/to/your-file.csv
 *
 * Requires the same .env setup as scripts/migrate.mjs (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
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
  : path.join(__dirname, 'data', 'garments-edited.csv');

if (!fs.existsSync(csvPath)) {
  console.error(`\nCan't find file: ${csvPath}`);
  console.error('Export the garments table as CSV from Supabase, edit it, and save it there');
  console.error('(or pass the path as an argument: npm run reimport-garments -- path/to/file.csv)\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ---- read the CSV ----
const fileBuffer = fs.readFileSync(csvPath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });

// Normalize header keys: strip a leading BOM character (a common artifact of
// CSV round-trips through Excel), trim whitespace, and lowercase — so a
// header like "ID", " Id ", or "\uFEFFid" all still match our "id" lookup below.
function normalizeKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const cleanKey = String(k).replace(/^\uFEFF/, '').trim().toLowerCase();
    out[cleanKey] = v;
  }
  return out;
}
const rows = rawRows.map(normalizeKeys);

console.log(`Loaded ${rows.length} rows from ${csvPath}`);
if (rows.length > 0) {
  console.log(`Detected columns: ${Object.keys(rows[0]).join(', ')}`);
}

const TEXT_FIELDS = [
  'source_file', 'sheet', 'excel_name', 'model_name', 'model1', 'brand', 'description', 'color',
  'customer_model', 'origin', 'moi', 'mfd', 'size', 'bottom_met_size', 'top_met_size',
  'master_ean', 'master_article', 'ean', 'article', 'ctn_no', 'image_url',
];
const NUMERIC_FIELDS = ['ratio', 'mrp', 'rrp'];

function clean(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') {
    const t = val.trim();
    return t === '' ? null : t;
  }
  return val;
}

async function main() {
  let updated = 0, skippedNoId = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const id = r.id;
    if (!id) { skippedNoId++; continue; }

    const patch = {};
    for (const f of TEXT_FIELDS) if (f in r) patch[f] = clean(r[f]) === null ? null : String(clean(r[f]));
    for (const f of NUMERIC_FIELDS) {
      if (f in r) {
        const v = clean(r[f]);
        patch[f] = v === null ? null : Number(v);
      }
    }

    const { error } = await supabase.from('garments').update(patch).eq('id', id);
    if (error) {
      console.warn(`  ! update failed for id ${id} ("${r.excel_name || ''} / ${r.color || ''} / ${r.size || ''}"): ${error.message}`);
      failed++;
    } else {
      updated++;
    }

    if ((i + 1) % 50 === 0) console.log(`  ...${i + 1}/${rows.length} processed`);
  }

  console.log('\n---- Garment re-import complete ----');
  console.log(`Updated:            ${updated}`);
  console.log(`Skipped (no id):    ${skippedNoId}`);
  console.log(`Failed:             ${failed}`);
}

main().catch(err => {
  console.error('Re-import failed:', err);
  process.exit(1);
});
