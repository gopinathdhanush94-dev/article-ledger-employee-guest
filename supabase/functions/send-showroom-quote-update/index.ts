import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { orderId } = await req.json();
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: order, error } = await admin.from('showroom_orders').select('order_number,customer_email,customer_name,status,comments,showroom_order_items(product_name,ean,quantity,required_date,availability,quoted_unit_price,account_note)').eq('id', orderId).single();
    if (error) throw error;
    const key = Deno.env.get('RESEND_API_KEY'); const from = Deno.env.get('SHOWROOM_FROM_EMAIL');
    if (!key || !from) throw new Error('Missing RESEND_API_KEY or SHOWROOM_FROM_EMAIL');
    const rows = (order.showroom_order_items || []).map((i: any) => `<tr><td>${i.product_name}</td><td>${i.ean || '—'}</td><td>${i.quantity}</td><td>${i.required_date}</td><td>${i.availability || 'Pending'}</td><td>${i.quoted_unit_price == null ? 'Pending' : `₹${Number(i.quoted_unit_price).toLocaleString('en-IN')}`}</td><td>${i.account_note || ''}</td></tr>`).join('');
    const html = `<h2>G-RECORDS Quotation Update</h2><p>Dear ${order.customer_name || 'Customer'},</p><p>Your showroom request <b>${order.order_number}</b> has been updated.</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Product</th><th>EAN</th><th>Qty</th><th>Required</th><th>Availability</th><th>Unit price</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table><p>${order.comments || ''}</p>`;
    const result = await fetch('https://api.resend.com/emails', { method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, body:JSON.stringify({from,to:[order.customer_email],subject:`G-RECORDS quotation update ${order.order_number}`,html}) });
    if (!result.ok) throw new Error(`Email send failed: ${result.status}`);
    await admin.from('showroom_orders').update({ status: 'quoted' }).eq('id', orderId);
    return new Response(JSON.stringify({ok:true}), {headers:{...cors,'Content-Type':'application/json'}});
  } catch (err) { return new Response(JSON.stringify({error:String(err?.message||err)}), {status:400,headers:{...cors,'Content-Type':'application/json'}}); }
});
