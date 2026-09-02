import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { createQuotationRequestPdf } from '../lib/quotationPdf.js';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ShowroomOrders({ canManageQuotations = false }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');
  const [priceDrafts, setPriceDrafts] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});

  async function load() {
    if (!canManageQuotations) return;
    setLoading(true); setError('');
    const { data, error: err } = await supabase
      .from('showroom_orders')
      .select('id,order_number,customer_name,customer_email,status,comments,submitted_at,updated_at,assigned_employee_id,quoted_at,showroom_order_items(id,product_name,ean,quantity,required_date,availability,quoted_unit_price,account_note)')
      .order('submitted_at', { ascending: false });
    if (err) setError(err.message); else setOrders(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [canManageQuotations]);

  const filtered = useMemo(() => filter === 'all' ? orders : orders.filter(o => o.status === filter), [orders, filter]);

  function setPriceDraft(itemId, value) {
    setPriceDrafts(current => ({ ...current, [itemId]: value }));
  }

  function patchLocal(orderId, itemId, patch) {
    setOrders(current => current.map(o => o.id !== orderId ? o : ({ ...o, showroom_order_items: (o.showroom_order_items || []).map(i => i.id !== itemId ? i : ({ ...i, ...patch })) })));
  }

  async function updateItem(orderId, itemId, field, value) {
    setSaving(itemId); setError(''); setMessage('');
    const patch = field === 'quoted_unit_price'
      ? { [field]: value === '' ? null : Math.max(0, Number(value)) }
      : { [field]: value || null };
    const { error: err } = await supabase.from('showroom_order_items').update(patch).eq('id', itemId);
    if (err) setError(err.message); else {
      patchLocal(orderId, itemId, patch);
      if (field === 'quoted_unit_price') {
        setPriceDrafts(current => { const next = { ...current }; delete next[itemId]; return next; });
      } else if (field === 'account_note') {
        setNoteDrafts(current => { const next = { ...current }; delete next[itemId]; return next; });
      }
    }
    setSaving(null);
  }

  async function markQuotationReady(order) {
    const items = order.showroom_order_items || [];
    const ready = items.length > 0 && items.every(i => i.quoted_unit_price != null && Number(i.quoted_unit_price) >= 0 && i.availability);
    if (!ready) return;
    setSaving(order.id); setError(''); setMessage('');
    const now = new Date().toISOString();
    const { error: err } = await supabase
      .from('showroom_orders')
      .update({ status: 'quoted', quoted_at: now })
      .eq('id', order.id);
    if (err) setError(err.message);
    else {
      setOrders(current => current.map(o => o.id === order.id ? { ...o, status: 'quoted', quoted_at: now } : o));
      setMessage(`${order.order_number} is ready. Download the PDF and share it manually with the customer.`);
    }
    setSaving(null);
  }

  async function deleteQuotation(order) {
    const confirmed = window.confirm(`Delete quotation ${order.order_number}?\n\nThis will permanently remove the quotation request and its selected articles. This cannot be undone.`);
    if (!confirmed) return;
    setSaving(`delete:${order.id}`); setError(''); setMessage('');
    const { error: err } = await supabase.from('showroom_orders').delete().eq('id', order.id);
    if (err) setError(err.message);
    else {
      setOrders(current => current.filter(o => o.id !== order.id));
      setMessage(`${order.order_number} was deleted.`);
    }
    setSaving(null);
  }

  function downloadQuotation(order) {
    const items = (order.showroom_order_items || []).map(item => ({
      product_name: item.product_name,
      ean: item.ean,
      quantity: item.quantity,
      required_date: item.required_date,
      quoted_unit_price: item.quoted_unit_price,
      availability: item.availability,
      account_note: item.account_note,
    }));
    createQuotationRequestPdf({
      orderNumber: order.order_number,
      customerName: order.customer_name || 'Registered Guest',
      customerEmail: order.customer_email || '',
      items,
      comments: order.comments || '',
      includePricing: true,
    });
  }

  if (!canManageQuotations) {
    return <main className="admin-page showroom-orders-page"><div className="panel glass-panel showroom-quotation-access-denied"><h2>Quotation Requests</h2><p>Your account is not authorized to view or edit quotation requests.</p></div></main>;
  }

  return <main className="admin-page showroom-orders-page">
    <div className="page-heading">
      <div><span className="eyebrow">SHOWROOM</span><h2>Quotation Requests</h2><p>Review guest requests, enter availability and pricing, mark the quotation ready, then download the PDF for manual sharing.</p></div>
      <button className="btn" onClick={load}>Refresh</button>
    </div>
    <div className="showroom-order-filters">
      {['all','quotation_requested','quoted'].map(s => <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>{s === 'all' ? 'All' : s === 'quotation_requested' ? 'Quotation Requested' : 'Quoted'}</button>)}
    </div>
    {error && <div className="showroom-error">{error}</div>}
    {message && <div className="showroom-success">{message}</div>}
    {loading ? <div className="panel glass-panel" style={{padding:30}}>Loading quotation requests…</div> : filtered.length === 0 ? <div className="panel glass-panel" style={{padding:30}}>No quotation requests in this status.</div> : <div className="showroom-orders-list">
      {filtered.map(order => {
        const items = order.showroom_order_items || [];
        const ready = items.length > 0 && items.every(i => i.quoted_unit_price != null && Number(i.quoted_unit_price) >= 0 && i.availability);
        const totalQty = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
        const total = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.quoted_unit_price || 0), 0);
        const isDeleting = saving === `delete:${order.id}`;
        return <section className="panel glass-panel showroom-order-card" key={order.id}>
          <div className="showroom-order-card-head">
            <div><span className="showroom-detail-kicker">{order.status === 'quoted' ? 'Quoted' : 'Quotation Requested'}</span><h3>{order.order_number}</h3><p>{order.customer_name || 'Guest'} · {order.customer_email} · {new Date(order.submitted_at).toLocaleString('en-IN')}</p></div>
            <div className="showroom-order-head-actions">
              {order.status !== 'quoted' && <button className="btn btn-primary" disabled={!ready || saving === order.id || isDeleting} onClick={() => markQuotationReady(order)}>{saving === order.id ? 'Saving…' : 'Mark quotation ready'}</button>}
              {order.status === 'quoted' && <button className="btn btn-primary" onClick={() => downloadQuotation(order)}>↓ Download quotation PDF</button>}
              <button className="btn showroom-delete-btn" disabled={isDeleting} onClick={() => deleteQuotation(order)}>{isDeleting ? 'Deleting…' : 'Delete quotation'}</button>
            </div>
          </div>
          <div className="showroom-order-table">
            <div className="showroom-order-table-head"><span>Product</span><span>Qty</span><span>Required</span><span>Availability</span><span>Unit price</span><span>Line total</span><span>Quotation note</span></div>
            {items.map(item => <div className="showroom-order-table-row" key={item.id}>
              <div><strong>{item.product_name || 'Product'}</strong><small>{item.ean || 'No EAN'}</small></div>
              <span>{item.quantity}</span><span>{item.required_date || '—'}</span>
              <select value={item.availability || ''} onChange={e => updateItem(order.id,item.id,'availability',e.target.value)} disabled={saving === item.id || order.status === 'quoted'}><option value="">Pending</option><option>Available</option><option>Partially available</option><option>Out of stock</option><option>Discontinued</option></select>
              <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Enter price" value={priceDrafts[item.id] ?? (item.quoted_unit_price ?? '')} onChange={e => setPriceDraft(item.id, e.target.value)} onBlur={e => updateItem(order.id,item.id,'quoted_unit_price',e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} disabled={saving === item.id || order.status === 'quoted'}/>
              <strong className="showroom-admin-line-total">{(priceDrafts[item.id] ?? item.quoted_unit_price) == null || (priceDrafts[item.id] ?? item.quoted_unit_price) === '' ? '—' : money(Number(item.quantity || 0) * Number(priceDrafts[item.id] ?? item.quoted_unit_price))}</strong>
              <input placeholder="Quotation note" value={noteDrafts[item.id] ?? (item.account_note || '')} onChange={e => setNoteDrafts(current => ({ ...current, [item.id]: e.target.value }))} onBlur={e => updateItem(order.id,item.id,'account_note',e.target.value)} disabled={saving === item.id || order.status === 'quoted'}/>
            </div>)}
          </div>
          <div className="showroom-order-total"><span>Total quantity <b>{totalQty}</b></span><span>Total quotation value <strong>{ready ? money(total) : 'Pending pricing'}</strong></span></div>
          {order.comments && <p className="showroom-order-comment"><b>Customer comments:</b> {order.comments}</p>}
          <div className="showroom-order-meta-line"><span>Customer contact: {order.customer_email || 'Not available'}</span><span>{order.quoted_at ? `Ready: ${new Date(order.quoted_at).toLocaleString('en-IN')}` : 'Quotation not ready'}</span></div>
        </section>;
      })}
    </div>}
  </main>;
}
