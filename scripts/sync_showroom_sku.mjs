/** Sync existing showroom product rows after showroom_sku_details_migration.sql. */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }
const supabase = createClient(url, key);
const main = async () => {
  const { data, error } = await supabase.from('products').select('id,sku_l,sku_w,sku_h,sku_dim_unit,sku_nw,sku_gw,sku_wt_unit');
  if (error) throw error;
  let updated=0, failed=0;
  for (const p of data || []) {
    const dimensions = p.sku_l != null && p.sku_w != null && p.sku_h != null ? `${p.sku_l} × ${p.sku_w} × ${p.sku_h}${p.sku_dim_unit ? ` ${p.sku_dim_unit}` : ''}` : null;
    const r = await supabase.from('showroom_items').update({sku_l:p.sku_l,sku_w:p.sku_w,sku_h:p.sku_h,sku_dim_unit:p.sku_dim_unit,sku_nw:p.sku_nw,sku_gw:p.sku_gw,sku_wt_unit:p.sku_wt_unit,dimensions}).eq('source_type','product').eq('source_id',p.id);
    if (r.error) { failed++; console.warn(`Failed ${p.id}: ${r.error.message}`); } else updated++;
  }
  console.log(`Showroom SKU sync complete. Products: ${(data||[]).length}; rows updated: ${updated}; failed: ${failed}`);
};
main().catch(e=>{console.error(e);process.exit(1);});
