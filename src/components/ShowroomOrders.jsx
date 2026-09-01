import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function ShowroomOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true); setError('');
    const { data, error: err } = await supabase.from('showroom_orders').select('id,order_number,customer_name,customer_email,status,comments,submitted_at,showroom_order_items(id,product_name,ean,quantity,required_date,availability,quoted_unit_price,account_note)').order('submitted_at', { ascending: false });
    if (err) setError(err.message); else setOrders(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function updateItem(orderId, itemId, field, value) {
    setSaving(itemId);
    const patch = field === 'quoted_unit_price' ? { [field]: value === '' ? null : Number(value) } : { [field]: value || null };
    const { error: err } = await supabase.from('showroom_order_items').update(patch).eq('id', itemId);
    if (err) setError(err.message); else setOrders(current => current.map(o => o.id !== orderId ? o : ({ ...o, showroom_order_items: o.showroom_order_items.map(i => i.id === itemId ? { ...i, ...patch } : i) })));
    setSaving(null);
  }

  async function notifyCustomer(order) {
    setSaving(order.id); setMessage('');
    const { error: err } = await supabase.functions.invoke('send-showroom-quote-update', { body: { orderId: order.id } });
    if (err) setError(err.message); else { setMessage(`Updated quotation sent to ${order.customer_email}.`); await load(); }
    setSaving(null);
  }

  return <main className="admin-page showroom-orders-page">
    <div className="page-heading"><div><span className="eyebrow">SHOWROOM</span><h2>Quotation Requests</h2><p>Review retail requests, enter pricing and availability, then send the confirmed quotation to the registered guest.</p></div><button className="btn" onClick={load}>Refresh</button></div>
    {error && <div className="showroom-error">{error}</div>}
    {message && <div className="showroom-success">{message}</div>}
    {loading ? <div className="panel glass-panel" style={{padding:30}}>Loading quotation requests…</div> : orders.length === 0 ? <div className="panel glass-panel" style={{padding:30}}>No showroom quotation requests yet.</div> : <div className="showroom-orders-list">
      {orders.map(order => <section className="panel glass-panel showroom-order-card" key={order.id}>
        <div className="showroom-order-card-head"><div><span className="showroom-detail-kicker">{order.status}</span><h3>{order.order_number}</h3><p>{order.customer_name || 'Guest'} · {order.customer_email} · {new Date(order.submitted_at).toLocaleString('en-IN')}</p></div><button className="btn btn-primary" disabled={saving === order.id} onClick={() => notifyCustomer(order)}>{saving === order.id ? 'Sending…' : 'Send quotation update'}</button></div>
        <div className="showroom-order-table"><div className="showroom-order-table-head"><span>Product</span><span>Qty</span><span>Required</span><span>Availability</span><span>Price</span><span>Accounts note</span></div>
          {(order.showroom_order_items || []).map(item => <div className="showroom-order-table-row" key={item.id}><div><strong>{item.product_name}</strong><small>{item.ean || 'No EAN'}</small></div><span>{item.quantity}</span><span>{item.required_date}</span><select value={item.availability || ''} onChange={e => updateItem(order.id,item.id,'availability',e.target.value)} disabled={saving === item.id}><option value="">Pending</option><option>Available</option><option>Partially available</option><option>Out of stock</option><option>Discontinued</option></select><input type="number" min="0" step="0.01" placeholder="Enter price" value={item.quoted_unit_price ?? ''} onChange={e => updateItem(order.id,item.id,'quoted_unit_price',e.target.value)} disabled={saving === item.id}/><input placeholder="Note" value={item.account_note || ''} onChange={e => updateItem(order.id,item.id,'account_note',e.target.value)} disabled={saving === item.id}/></div>)}
        </div>
        {order.comments && <p className="showroom-order-comment"><b>Customer comments:</b> {order.comments}</p>}
      </section>)}
    </div>}
  </main>;
}
