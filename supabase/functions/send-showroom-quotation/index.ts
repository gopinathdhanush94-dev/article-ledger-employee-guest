import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { orderId } = await req.json();
    if (!orderId) throw new Error('orderId is required');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: order, error } = await admin.from('showroom_orders').select('id,order_number,customer_email,customer_name,status,comments,showroom_order_items(product_name,ean,model,category,quantity,required_date)').eq('id', orderId).single();
    if (error) throw error;
    const accountsEmail = Deno.env.get('ACCOUNTS_EMAIL');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('SHOWROOM_FROM_EMAIL');
    if (!accountsEmail || !resendKey || !from) throw new Error('Missing ACCOUNTS_EMAIL, RESEND_API_KEY or SHOWROOM_FROM_EMAIL secrets');
    const rows = (order.showroom_order_items || []).map((i: any) => `<tr><td>${i.product_name}</td><td>${i.ean || '—'}</td><td>${i.quantity}</td><td>${i.required_date}</td></tr>`).join('');
    const html = `<h2>G-RECORDS Showroom Quotation Request</h2><p><b>Request:</b> ${order.order_number}</p><p><b>Customer:</b> ${order.customer_name || 'Registered Guest'}<br><b>Email:</b> ${order.customer_email}</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Product</th><th>EAN</th><th>Qty</th><th>Required date</th></tr></thead><tbody>${rows}</tbody></table><p><b>Comments:</b> ${order.comments || '—'}</p><p>Please update pricing and availability in the showroom order record. The customer-facing request intentionally contains no MRP or selling price.</p>`;
    const send = async (to: string[], subject: string) => fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, subject, html }) });
    const [customer, accounts] = await Promise.all([
      send([order.customer_email], `G-RECORDS quotation request ${order.order_number}`),
      send([accountsEmail], `Quotation request ${order.order_number} — pricing & availability required`),
    ]);
    if (!customer.ok || !accounts.ok) throw new Error(`Email send failed: customer ${customer.status}, accounts ${accounts.status}`);
    return new Response(JSON.stringify({ ok: true, orderNumber: order.order_number }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
