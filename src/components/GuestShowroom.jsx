import React, { useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '../supabaseClient.js';
import { createQuotationRequestPdf } from '../lib/quotationPdf.js';
import ScannerModal from './ScannerModal.jsx';
import { useAuth } from '../lib/useAuth.js';

const CATEGORY_FALLBACK = ['All', 'Beauty', 'Home', 'Kitchen', 'Garments', 'Travel'];

function getImage(item) {
  return item?.image_url || '';
}

function getVideo(item) {
  return String(item?.video_url || '').trim();
}

function videoEmbedUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : '';
    }
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v') || url.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
      return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : '';
    }
  } catch {}
  return '';
}

function isDirectVideo(value) {
  return /\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(String(value || '').trim());
}

function displayName(item) {
  const candidates = [item?.description, item?.name, item?.model, item?.article_no];
  const value = candidates.find(v => {
    const t = String(v ?? '').trim();
    return t && !/^untitled product$/i.test(t);
  });
  return value ? String(value).trim() : (item?.ean ? `Product ${item.ean}` : 'Product');
}

function productCode(item) {
  return item?.ean || item?.article_no || item?.model || '';
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6" /><path d="M16 16l5 5" /></svg>;
}
function QrIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 14h2v2h-2zM19 14h1v6h-5v-2h4zM14 19h2v1h-2z" /></svg>;
}
function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
}
function ChevronRightIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>;
}

function HeartIcon({ filled = false }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.7c0 5.1-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" fill={filled ? "currentColor" : "none"} /></svg>;
}
function CartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2l1.7 9.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7"/><circle cx="10" cy="19" r="1.2"/><circle cx="18" cy="19" r="1.2"/></svg>;
}
function VideoIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg>;
}
function OrderIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h4M9 12h6M9 16h6M9 8h3"/></svg>;
}

function ShowroomHeader({ search, setSearch, onScan, onSignOut, favouriteCount = 0, cartCount = 0, onFavourites, onCart, onOrders, orderCount = 0 }) {
  const [guestMenuOpen, setGuestMenuOpen] = useState(false);

  // Close the Guest menu whenever the user clicks/taps anywhere outside it.
  // A document-level listener is used instead of a transparent backdrop so
  // clicks on the showroom content are never blocked by the menu layer.
  useEffect(() => {
    if (!guestMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!event.target.closest('.showroom-guest-menu-wrap')) {
        setGuestMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setGuestMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [guestMenuOpen]);

  return (
    <header className="showroom-header">
      <div className="showroom-brand-lockup">
        <div className="showroom-mark">G</div>
        <div>
          <div className="showroom-brand-eyebrow">G-RECORDS</div>
          <div className="showroom-brand-title">Product Showroom</div>
        </div>
      </div>
      <div className="showroom-header-actions">
        <div className="showroom-search">
          <SearchIcon />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" aria-label="Search showroom products" />
        </div>
        <button className="showroom-scan-btn" type="button" onClick={onScan}><QrIcon /><span>Scan</span></button>
        <button className="showroom-icon-btn" type="button" onClick={onFavourites} aria-label={`Favourites${favouriteCount ? `, ${favouriteCount} items` : ''}`} title="Favourites">
          <HeartIcon filled={favouriteCount > 0} />
          {favouriteCount > 0 && <span className="showroom-count-badge">{favouriteCount}</span>}
        </button>
        <button className="showroom-icon-btn" type="button" onClick={onCart} aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`} title="Cart">
          <CartIcon />
          {cartCount > 0 && <span className="showroom-count-badge">{cartCount}</span>}
        </button>
        <button className="showroom-icon-btn" type="button" onClick={onOrders} aria-label={`Order history${orderCount ? `, ${orderCount} recent orders` : ''}`} title="Order history">
          <OrderIcon />
          {orderCount > 0 && <span className="showroom-count-badge">{orderCount > 9 ? '9+' : orderCount}</span>}
        </button>
        <div className="showroom-guest-menu-wrap">
          <button className="showroom-guest-btn" type="button" onClick={() => setGuestMenuOpen(open => !open)} aria-haspopup="menu" aria-expanded={guestMenuOpen}>Guest <span className="showroom-guest-chevron">⌄</span></button>
          {guestMenuOpen && <>
            <div className="showroom-guest-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setGuestMenuOpen(false); onSignOut(); }}>Sign out</button>
            </div>
          </>}
        </div>
      </div>
    </header>
  );
}

function PopupShell({ title, eyebrow, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKeyDown, true); document.body.style.overflow = previousOverflow; };
  }, [onClose]);
  return <div className="showroom-popup-overlay" role="presentation" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="showroom-popup" role="dialog" aria-modal="true" aria-label={title}>
      <div className="showroom-popup-header"><div><div className="showroom-popup-eyebrow">{eyebrow || 'G-RECORDS'}</div><h2>{title}</h2></div><button type="button" className="showroom-popup-close" onClick={onClose} aria-label="Close">×</button></div>
      <div className="showroom-popup-body">{children}</div>
    </section>
  </div>;
}

async function enrichQuotationItems(items) {
  const rows = Array.isArray(items) ? items : [];
  const ids = rows.map(item => item?.showroom_item_id).filter(Boolean);
  if (!ids.length) return rows;
  const { data } = await supabase
    .from('showroom_items')
    .select('id,name,description,model,article_no,ean,category,image_url')
    .in('id', ids);
  const byId = new Map((data || []).map(row => [String(row.id), row]));
  return rows.map(item => {
    const row = byId.get(String(item.showroom_item_id));
    return row ? { ...row, ...item, description: row.description || item.description, name: row.name || item.name } : item;
  });
}


function formatOrderStatus(status) {
  return String(status || 'quotation_requested')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

async function downloadOrderQuotation(order) {
  let items = (Array.isArray(order?.showroom_order_items) ? order.showroom_order_items : []).map(item => ({
    ...item,
    requiredDate: item.required_date || '',
    product_name: item.product_name || '',
  }));
  if (!items.length) return;
  items = await enrichQuotationItems(items).catch(() => items);
  createQuotationRequestPdf({
    orderNumber: order.order_number,
    customerName: order.customer_name || 'Registered Guest',
    customerEmail: order.customer_email || '',
    items,
    comments: order.comments || '',
    includePricing: String(order.status) === 'quoted',
  });
}


function OrderHistoryPopup({ onClose, session }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  async function loadHistory() {
    setLoading(true);
    setError('');
    try {
      if (!session?.user?.id) {
        setOrders([]);
        return;
      }

      // Fetch orders first, then fetch line items separately. This avoids relying
      // on PostgREST's embedded relationship cache, which may be stale when an
      // order-item foreign key was recently migrated.
      const { data: orderRows, error: orderError } = await supabase
        .from('showroom_orders')
        .select('id,order_number,customer_name,customer_email,status,comments,submitted_at,updated_at')
        .eq('customer_user_id', session.user.id)
        .order('submitted_at', { ascending: false })
        .limit(20);

      if (orderError) throw orderError;

      const baseOrders = orderRows || [];
      if (!baseOrders.length) {
        setOrders([]);
        return;
      }

      const orderIds = baseOrders.map(order => order.id);
      const { data: itemRows, error: itemError } = await supabase
        .from('showroom_order_items')
        .select('id,order_id,product_name,ean,quantity,required_date,availability,quoted_unit_price,account_note,quoted_at')
        .in('order_id', orderIds)
        .order('id', { ascending: true });

      if (itemError) throw itemError;

      const itemsByOrder = new Map();
      (itemRows || []).forEach(item => {
        const list = itemsByOrder.get(String(item.order_id)) || [];
        list.push(item);
        itemsByOrder.set(String(item.order_id), list);
      });

      setOrders(baseOrders.map(order => ({
        ...order,
        showroom_order_items: itemsByOrder.get(String(order.id)) || [],
      })));
    } catch (err) {
      console.error('Showroom order history failed:', err);
      setError(err?.message || 'Unable to load order history.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadHistory();
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  return <PopupShell title="Order history" eyebrow="G-RECORDS · ORDERS" onClose={onClose}>
    {loading ? (
      <div className="showroom-empty-state showroom-history-loading"><div className="showroom-loader" /><p>Loading your recent orders…</p></div>
    ) : error ? (
      <div className="showroom-error"><span>{error}</span><button type="button" onClick={loadHistory}>Retry</button></div>
    ) : orders.length === 0 ? (
      <div className="showroom-popup-empty">
        <div className="showroom-popup-empty-icon"><OrderIcon /></div>
        <h3>No quotation requests yet</h3>
        <p>Your submitted quotation requests will appear here.</p>
      </div>
    ) : (
      <div className="showroom-history-list">
        {orders.map(order => {
          const items = Array.isArray(order.showroom_order_items) ? order.showroom_order_items : [];
          const totalQty = items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
  const totalValue = items.reduce((sum, item) => sum + (Math.max(1, Number(item.quantity) || 1) * Math.max(0, Number(item.quoted_unit_price) || 0)), 0);
  const money = value => `Rs ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const isOpen = expanded === order.id;
          return (
            <article className={`showroom-history-order ${isOpen ? 'is-open' : ''}`} key={order.id}>
              <div className="showroom-history-order-head">
                <button type="button" className="showroom-history-order-toggle" onClick={() => setExpanded(isOpen ? null : order.id)} aria-expanded={isOpen}>
                  <div>
                    <span className={`showroom-history-status status-${String(order.status || '').replace(/_/g, '-')}`}>{formatOrderStatus(order.status)}</span>
                    <strong>{order.order_number}</strong>
                    <small>{new Date(order.submitted_at).toLocaleString('en-IN')}</small>
                  </div>
                  <div className="showroom-history-summary">
                    <span>{items.length} product{items.length === 1 ? '' : 's'}</span>
                    <span>{totalQty} pcs</span>
                    <span>{isOpen ? '−' : '+'}</span>
                  </div>
                </button>
                <button type="button" className="showroom-history-download" onClick={() => downloadOrderQuotation(order)} title={String(order.status) === 'quoted' ? 'Download final quotation PDF' : 'Download quotation request PDF'} aria-label={`Download ${order.order_number} PDF`}>↓ PDF</button>
              </div>

              {isOpen && (
                <div className="showroom-history-details">
                  <div className="showroom-history-lines">
                    {items.map(item => (
                      <div className="showroom-history-line" key={item.id}>
                        <div>
                          <strong>{item.product_name || 'Product'}</strong>
                          <small>{item.ean ? `EAN ${item.ean}` : 'No EAN'}</small>
                        </div>
                        <div className="showroom-history-line-meta">
                          <span><b>Qty</b> {item.quantity}</span>
                          <span><b>Required</b> {item.required_date || '—'}</span>
                          <span><b>Availability</b> {item.availability || 'Pending'}</span>
                          {item.quoted_unit_price != null && <><span><b>Unit price</b> ₹{Number(item.quoted_unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span><b>Line total</b> ₹{(Number(item.quantity || 0) * Number(item.quoted_unit_price || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></>}
                        </div>
                        {item.account_note && <div className="showroom-history-note">{item.account_note}</div>}
                      </div>
                    ))}
                  </div>
                  {order.comments && <div className="showroom-history-comment"><b>Comments</b><span>{order.comments}</span></div>}
                  {String(order.status) === 'quoted' && <div className="showroom-history-quote-total"><span>Final quotation value</span><strong>₹{items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.quoted_unit_price || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>}
                  <div className="showroom-history-footer">
                    <span>Last updated {new Date(order.updated_at || order.submitted_at).toLocaleString('en-IN')}</span>
                    <span>{formatOrderStatus(order.status)}</span>
                    <button type="button" className="showroom-history-download-link" onClick={() => downloadOrderQuotation(order)}>{String(order.status) === 'quoted' ? 'Download final quotation PDF' : 'Download request PDF'}</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    )}
  </PopupShell>;
}

function SelectionPopup({ mode, products, onClose, onOpen, isFavourite, inCart, onToggleFavourite, onToggleCart, cartQuantities, setCartQuantities, customerProfile, session, storagePrefix }) {
  const isCart = mode === 'cart';
  const storageKey = name => `${storagePrefix}-${name}`;
  const [comments, setComments] = useState(() => { try { return localStorage.getItem(storageKey('order-comments')) || ''; } catch { return ''; } });
  const [requiredDates, setRequiredDates] = useState(() => { try { return JSON.parse(localStorage.getItem(storageKey('required-dates')) || '{}'); } catch { return {}; } });
  const [preview, setPreview] = useState(() => { try { return localStorage.getItem(storageKey('order-preview')) === '1'; } catch { return false; } });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const selectedProducts = products.filter(item => isCart ? inCart(item) : isFavourite(item));
  const updateQty = (id, value) => setCartQuantities(current => ({ ...current, [String(id)]: Math.max(1, Math.floor(Number(value) || 1)) }));
  const updateRequiredDate = (id, value) => setRequiredDates(current => { const next = { ...current, [String(id)]: value }; localStorage.setItem(storageKey('required-dates'), JSON.stringify(next)); return next; });
  useEffect(() => { try { localStorage.setItem(storageKey('order-comments'), comments); } catch {} }, [comments]);
  useEffect(() => { try { localStorage.setItem(storageKey('order-preview'), preview ? '1' : '0'); } catch {} }, [preview]);

  async function submitOrder() {
    if (!selectedProducts.length) return;
    if (selectedProducts.some(item => !requiredDates[String(item.id)])) {
      setSubmitError('Please enter the required date for every product.');
      return;
    }

    const customerEmail = customerProfile?.email || session?.user?.email || '';
    if (!session?.user?.id || !customerEmail) {
      setSubmitError('Please sign in with a registered guest account before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    // Submit the order and all lines through one database transaction (RPC).
    // This prevents partial orders and eliminates client-side FK timing/RLS issues.
    const items = selectedProducts.map(item => ({
      showroom_item_id: item.id,
      product_name: displayName(item),
      ean: item.ean || null,
      quantity: Math.max(1, Math.floor(Number(cartQuantities[String(item.id)] || 1))),
      required_date: requiredDates[String(item.id)],
    }));

    const { data: result, error: submitRpcError } = await supabase.rpc('submit_showroom_quotation_request', {
      p_items: items,
      p_comments: comments || null,
    });

    if (submitRpcError) {
      console.error('Showroom quotation submission failed:', submitRpcError);
      setSubmitError(submitRpcError.message || 'Could not submit the quotation request. Please try again.');
      setSubmitting(false);
      return;
    }

    const order = Array.isArray(result) ? result[0] : result;
    if (!order?.id || !order?.order_number) {
      setSubmitError('The quotation was saved, but no request number was returned. Please contact an administrator.');
      setSubmitting(false);
      return;
    }

    const orderNumber = order.order_number;
    const pdfItems = await enrichQuotationItems(items).catch(() => items);
    createQuotationRequestPdf({
      orderNumber,
      customerName: customerProfile?.full_name || session.user.email,
      customerEmail,
      items: pdfItems,
      comments,
    });

    setSubmitted(orderNumber);
    setSubmitting(false);
    setCart([]);
    try {
      localStorage.removeItem(storageKey('cart'));
      localStorage.removeItem(storageKey('order-comments'));
      localStorage.removeItem(storageKey('order-preview'));
      localStorage.removeItem(storageKey('required-dates'));
    } catch {}
  }

  // Keep a local empty-cart setter without mutating the parent's source of truth
  // through a hidden dependency.
  const setCart = updater => {
    const current = products.filter(inCart).map(x => x.id);
    const next = typeof updater === 'function' ? updater(current) : updater;
    current.forEach(id => { if (!next.some(x => String(x) === String(id))) onToggleCart(products.find(x => String(x.id) === String(id))); });
  };

  if (submitted && isCart) return <PopupShell title="Request submitted" eyebrow="G-RECORDS · QUOTATION" onClose={onClose}>
    <div className="showroom-popup-empty"><div className="showroom-popup-empty-icon">✓</div><h3>Quotation request sent</h3><p>Request <strong>{submitted}</strong> has been saved successfully. The quotation team will review it in the Employee Access portal. Your PDF has also been downloaded.</p><div className="showroom-popup-footer"><button type="button" className="showroom-primary-btn" onClick={onClose}>Done</button></div></div>
  </PopupShell>;

  if (preview && isCart) return <PopupShell title="Quotation request preview" eyebrow="G-RECORDS · QUOTATION" onClose={onClose}>
    <div className="showroom-preview-list">{selectedProducts.map(item => { const qty = Math.max(1, Number(cartQuantities[String(item.id)] || 1)); return <div className="showroom-preview-row" key={item.id}><div><strong>{displayName(item)}</strong><span>Qty {qty} · Required {requiredDates[String(item.id)] || '-'}</span></div><strong className="showroom-preview-line-total">{qty} pcs</strong></div>; })}</div><div className="showroom-order-total"><span>Total quantity</span><strong>{selectedProducts.reduce((sum, item) => sum + Math.max(1, Number(cartQuantities[String(item.id)] || 1)), 0)}</strong></div>
    <div className="showroom-order-meta"><div className="wide"><b>Comments</b><span>{comments || '-'}</span></div></div>
    {submitError && <div className="showroom-error">{submitError}</div>}
    <div className="showroom-popup-footer"><button type="button" className="showroom-outline-btn" onClick={() => setPreview(false)}>Edit request</button><button type="button" className="showroom-primary-btn" disabled={submitting} onClick={submitOrder}>{submitting ? 'Submitting…' : 'Submit quotation request'}</button></div>
  </PopupShell>;

  return <PopupShell title={isCart ? 'Cart' : 'Favourite products'} eyebrow="G-RECORDS" onClose={onClose}>
    <div className="showroom-popup-subtitle">{selectedProducts.length} selected product{selectedProducts.length === 1 ? '' : 's'}</div>
    {selectedProducts.length === 0 ? <div className="showroom-popup-empty"><div className="showroom-popup-empty-icon">{isCart ? <CartIcon /> : <HeartIcon />}</div><h3>{isCart ? 'Your cart is empty' : 'No favourites yet'}</h3><p>{isCart ? 'Use Add to cart on a product to save it here.' : 'Use the heart button on a product to save it here.'}</p></div> : <>
      <div className="showroom-popup-list">{selectedProducts.map(item => <div className={`showroom-popup-item ${isCart ? 'showroom-cart-item' : ''}`} key={item.id}>
        <button type="button" className="showroom-popup-item-image" onClick={() => { onClose(); onOpen(item); }}>{getImage(item) ? <img src={getImage(item)} alt="" /> : <span>{String(item.category || 'P').slice(0,1)}</span>}</button>
        <div className="showroom-popup-item-info"><button type="button" className="showroom-popup-item-name" onClick={() => { onClose(); onOpen(item); }}>{displayName(item)}</button><span>{item.category || 'Product'}{item.ean ? ` · EAN ${item.ean}` : ''}</span></div>
        {isCart && <div className="showroom-cart-request-fields"><label>Qty<input className="showroom-qty-input" type="number" min="1" value={cartQuantities[String(item.id)] || 1} onChange={e => updateQty(item.id, e.target.value)} /></label><label>Required date<input type="date" value={requiredDates[String(item.id)] || ''} onChange={e => updateRequiredDate(item.id, e.target.value)} /></label></div>}
        <div className="showroom-popup-item-actions"><button type="button" className="showroom-small-btn" onClick={() => onToggleFavourite(item)} title={isFavourite(item) ? 'Remove favourite' : 'Add favourite'}><HeartIcon filled={isFavourite(item)} /></button><button type="button" className={`showroom-small-btn ${isCart ? 'active' : inCart(item) ? 'active' : ''}`} onClick={() => onToggleCart(item)} title={isCart ? 'Remove from cart' : inCart(item) ? 'Remove from cart' : 'Add to cart'}><CartIcon /></button></div>
      </div>)}</div>
      {isCart && <><div className="showroom-order-fields"><label className="wide">Comments<textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Comments related to this quotation request…" rows="3" /></label></div>{submitError && <div className="showroom-error">{submitError}</div>}<div className="showroom-popup-footer"><button type="button" className="showroom-primary-btn" onClick={() => setPreview(true)}>Preview quotation request</button></div></>}
    </>}
  </PopupShell>;
}

function ProductCard({ item, onOpen, isFavourite, inCart, onToggleFavourite, onToggleCart }) {
  return (
    <article className="showroom-product-card">
      <button type="button" className="showroom-product-card-main" onClick={() => onOpen(item)} aria-label={`View ${displayName(item)}`}>
        <div className="showroom-product-image-wrap">
          {getImage(item) ? <img src={getImage(item)} alt="" loading="lazy" /> : <div className="showroom-image-fallback">{String(item?.category || 'PRODUCT').slice(0, 1).toUpperCase()}</div>}
          {item.featured && <span className="showroom-featured-pill">Featured</span>}
          {getVideo(item) && <span className="showroom-video-pill"><VideoIcon /> Video</span>}
        </div>
        <div className="showroom-product-card-body">
          <div className="showroom-product-category">{item.category || item.source_type}</div>
          <h3>{displayName(item)}</h3>
          <p>{[item.model, item.ean ? `EAN: ${item.ean}` : ''].filter(Boolean).join(' · ') || 'Product details'}</p>
          <span className="showroom-view-link">View details <ArrowIcon /></span>
        </div>
      </button>
      <div className="showroom-card-actions">
        <button type="button" className={`showroom-card-action ${isFavourite ? 'active' : ''}`} onClick={() => onToggleFavourite(item)} aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}>
          <HeartIcon filled={isFavourite} /> {isFavourite ? 'Favourited' : 'Favourite'}
        </button>
        <button type="button" className={`showroom-card-action ${inCart ? 'active' : ''}`} onClick={() => onToggleCart(item)} aria-label={inCart ? 'Remove from cart' : 'Add to cart'}>
          <CartIcon /> {inCart ? 'In cart' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}

function getGallery(item) {
  const candidates = [item?.image_url, ...(Array.isArray(item?.images) ? item.images : []), ...(Array.isArray(item?.image_urls) ? item.image_urls : [])];
  return [...new Set(candidates.filter(Boolean).map(String))];
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value);
}

function skuDimensions(item) {
  const values = [item?.sku_l, item?.sku_w, item?.sku_h];
  if (!values.some(v => v !== null && v !== undefined && v !== '')) return '';
  const unit = item?.sku_dim_unit ? ` ${item.sku_dim_unit}` : '';
  return `${values.map(v => formatNumber(v) || '-').join(' × ')}${unit}`;
}

function skuWeight(item, net = true) {
  const value = net ? item?.sku_nw : item?.sku_gw;
  if (value === null || value === undefined || value === '') return '';
  return `${formatNumber(value)}${item?.sku_wt_unit ? ` ${item.sku_wt_unit}` : ''}`;
}

function ProductDetail({ item, onBack, onScanAnother, isFavourite, inCart, onToggleFavourite, onToggleCart }) {
  const gallery = getGallery(item);
  const [imageOpen, setImageOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const highlights = Array.isArray(item?.features) ? item.features : [];

  useEffect(() => {
    if (!imageOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setImageOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [imageOpen]);

  const currentImage = gallery[activeImage] || '';

  return (
    <div className="showroom-detail-page">
      <button className="showroom-back" type="button" onClick={onBack}>← Back to showroom</button>
      <div className="showroom-detail-shell">
        <div className="showroom-detail-media-area">
          <div
            className="showroom-detail-media showroom-detail-media-compact"
            onClick={() => currentImage && setImageOpen(true)}
            role={currentImage ? 'button' : undefined}
            tabIndex={currentImage ? 0 : undefined}
            onKeyDown={e => { if (currentImage && (e.key === 'Enter' || e.key === ' ')) setImageOpen(true); }}
          >
            {currentImage ? <img src={currentImage} alt={displayName(item)} /> : <div className="showroom-detail-fallback">{String(item?.category || 'PRODUCT').slice(0, 1).toUpperCase()}</div>}
            {currentImage && <div className="showroom-image-hint">Click image to enlarge</div>}
          </div>
          {gallery.length > 0 && (
            <div className="showroom-thumbnail-strip" aria-label="Product images">
              {gallery.map((src, index) => (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  className={`showroom-thumbnail ${activeImage === index ? 'active' : ''}`}
                  onClick={() => setActiveImage(index)}
                  aria-label={`View product image ${index + 1}`}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="showroom-detail-main">
          <div className="showroom-detail-kicker">{item.category || 'PRODUCT'}</div>
          <h1>{displayName(item)}</h1>
          <p className="showroom-detail-subtitle">{item.model || 'Product details'}</p>

          <div className="showroom-detail-top-actions">
            <button type="button" className={`showroom-detail-icon-btn ${isFavourite ? 'active' : ''}`} onClick={() => onToggleFavourite(item)} aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'} title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}>
              <HeartIcon filled={isFavourite} />
            </button>
            <button type="button" className={`showroom-detail-icon-btn ${inCart ? 'active' : ''}`} onClick={() => onToggleCart(item)} aria-label={inCart ? 'Remove from cart' : 'Add to cart'} title={inCart ? 'Remove from cart' : 'Add to cart'}>
              <CartIcon />
            </button>
            <button type="button" className="showroom-detail-icon-btn" onClick={onScanAnother} aria-label="Scan another product" title="Scan another product">
              <QrIcon />
            </button>
          </div>

          <section className="showroom-section showroom-sku-section">
            <div className="showroom-section-title">SKU details</div>
            <div className="showroom-sku-grid">
              {[
                ['EAN', item.ean],
                ['Model', item.model],
                ['Category', item.category],
                ['L × B × H', skuDimensions(item)],
                ['Net weight', skuWeight(item, true)],
                ['Gross weight', skuWeight(item, false)],
              ].map(([label, value]) => (
                <div className="showroom-sku-item" key={label}><span>{label}</span><strong>{value || '-'}</strong></div>
              ))}
            </div>
          </section>

          {item.dimensions && !skuDimensions(item) && (
            <section className="showroom-section">
              <div className="showroom-section-title">Dimensions</div>
              <p className="showroom-description">{item.dimensions}</p>
            </section>
          )}

          {getVideo(item) && (
            <section className="showroom-section showroom-video-section">
              <div className="showroom-section-title showroom-video-title"><span>WATCH IN ACTION</span><strong>Product video</strong></div>
              <div className="showroom-video-frame">
                {videoEmbedUrl(getVideo(item)) ? (
                  <iframe src={videoEmbedUrl(getVideo(item))} title={`${displayName(item)} product video`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                ) : isDirectVideo(getVideo(item)) ? (
                  <video controls playsInline preload="metadata" poster={currentImage || undefined}><source src={getVideo(item)} /></video>
                ) : (
                  <a href={getVideo(item)} target="_blank" rel="noreferrer" className="showroom-video-link"><VideoIcon /> Open product video</a>
                )}
              </div>
            </section>
          )}

          {(item.description || highlights.length) && (
            <section className="showroom-section">
              <div className="showroom-section-title">About this product</div>
              {item.description && <p className="showroom-description">{item.description}</p>}
              {highlights.length > 0 && <div className="showroom-feature-list">{highlights.map((feature, i) => <span key={i}>✓ {feature}</span>)}</div>}
            </section>
          )}

        </div>
      </div>

      {imageOpen && currentImage && (
        <div className="showroom-image-viewer" role="dialog" aria-modal="true" aria-label="Product image viewer" onClick={() => setImageOpen(false)}>
          <button type="button" className="showroom-image-close" onClick={e => { e.stopPropagation(); setImageOpen(false); }} aria-label="Close image viewer">×</button>
          <div className="showroom-image-viewer-content" onClick={e => e.stopPropagation()}>
            <img className="showroom-image-viewer-main" src={currentImage} alt={displayName(item)} />
            {gallery.length > 0 && (
              <div className="showroom-image-viewer-thumbs">
                {gallery.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    className={`showroom-thumbnail ${activeImage === index ? 'active' : ''}`}
                    onClick={() => setActiveImage(index)}
                    aria-label={`View product image ${index + 1}`}
                  >
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuestShowroom() {
  const { signOut, profile, session } = useAuth();
  const storageIdentity = session?.user?.id || 'anonymous';
  const storagePrefix = `g-records-showroom:${storageIdentity}`;
  const guestStateKey = `article-ledger:guest-state:${storageIdentity}`;
  const savedGuestState = (() => {
    try { return JSON.parse(sessionStorage.getItem(guestStateKey) || '{}'); } catch { return {}; }
  })();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(savedGuestState.search || '');
  const [category, setCategory] = useState(savedGuestState.category || 'All');
  const [selected, setSelected] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [collectionMode, setCollectionMode] = useState(savedGuestState.collectionMode || 'all');
  const [featuredExpanded, setFeaturedExpanded] = useState(false);
  const [favourites, setFavourites] = useState(() => { try { return JSON.parse(localStorage.getItem(`${storagePrefix}-favourites`) || '[]'); } catch { return []; } });
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem(`${storagePrefix}-cart`) || '[]'); } catch { return []; } });
  const [cartQuantities, setCartQuantities] = useState(() => { try { return JSON.parse(localStorage.getItem(`${storagePrefix}-cart-quantities`) || '{}'); } catch { return {}; } });
  const [popup, setPopup] = useState(null);
  const restoredSelectionRef = useRef(false);

  const directQrCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('qr') || params.get('product') || params.get('ean') || '';
  }, []);

  useEffect(() => {
    // Restore a previously open product only once. Without this guard, closing
    // a restored detail page sets selected=null, which causes this effect to
    // immediately restore the same product from the stale initial snapshot.
    if (restoredSelectionRef.current || directQrCode || !items.length || selected || !savedGuestState.selectedId) return;
    restoredSelectionRef.current = true;
    const restored = items.find(item => String(item.id) === String(savedGuestState.selectedId));
    if (restored) setSelected(restored);
  }, [directQrCode, items, selected, savedGuestState.selectedId]);
  // Mobile Safari/Brave back-swipe support: every in-app detail/popup gets a
  // history entry. A browser back gesture therefore closes the top layer instead
  // of leaving the showroom page. The URL itself is unchanged.
  const overlayHistoryRef = useRef([]);

  function pushShowroomHistory(layer) {
    overlayHistoryRef.current.push(layer);
    window.history.pushState({ ...(window.history.state || {}), showroomOverlay: layer }, '', window.location.href);
  }

  function popShowroomHistory(layer) {
    const stack = overlayHistoryRef.current;
    const top = stack[stack.length - 1];
    if (top === layer) {
      // Let the popstate handler remove the layer. Removing it here as well
      // would make a multi-layer stack lose the layer underneath on mobile.
      window.history.back();
      return true;
    }
    return false;
  }

  useEffect(() => {
    const onPopState = () => {
      const layer = overlayHistoryRef.current.pop();
      if (layer === 'scanner') { setScannerOpen(false); return; }
      if (layer === 'order-history') { setOrderHistoryOpen(false); return; }
      if (layer === 'popup') { setPopup(null); return; }
      if (layer === 'detail') { setSelected(null); return; }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => { localStorage.setItem(`${storagePrefix}-favourites`, JSON.stringify(favourites)); }, [favourites]);
  useEffect(() => { localStorage.setItem(`${storagePrefix}-cart`, JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem(`${storagePrefix}-cart-quantities`, JSON.stringify(cartQuantities)); }, [cartQuantities]);

  // Preserve the guest's showroom position across a browser reload/tab
  // suspension. The Supabase session remains the source of truth for access;
  // this only restores non-sensitive UI state.
  useEffect(() => {
    try {
      sessionStorage.setItem(guestStateKey, JSON.stringify({
        selectedId: selected?.id || null,
        search,
        category,
        collectionMode,
      }));
    } catch {}
  }, [guestStateKey, selected?.id, search, category, collectionMode]);


  // Local storage can contain IDs from an older showroom dataset. Once the
  // current showroom rows are loaded, remove those stale IDs so the header
  // badges always match what can actually be shown in the favourites/cart.
  useEffect(() => {
    if (!items.length) return;
    const validIds = new Set(items.map(item => String(item.id)));
    setFavourites(current => {
      const next = current.filter(id => validIds.has(String(id)));
      return next.length === current.length ? current : next;
    });
    setCart(current => {
      const next = current.filter(id => validIds.has(String(id)));
      return next.length === current.length ? current : next;
    });
    setCartQuantities(current => {
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => validIds.has(String(id))));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [items]);

  const [recentOrderCount, setRecentOrderCount] = useState(0);

  const favouriteCount = useMemo(() => {
    const validIds = new Set(items.map(item => String(item.id)));
    return favourites.filter(id => validIds.has(String(id))).length;
  }, [items, favourites]);

  const cartCount = useMemo(() => {
    const validIds = new Set(items.map(item => String(item.id)));
    return cart.filter(id => validIds.has(String(id))).length;
  }, [items, cart]);

  const isFavourite = item => favourites.some(id => String(id) === String(item.id));
  const inCart = item => cart.some(id => String(id) === String(item.id));
  const toggleFavourite = item => setFavourites(current => current.some(id => String(id) === String(item.id)) ? current.filter(id => String(id) !== String(item.id)) : [...current, item.id]);
  const toggleCart = item => setCart(current => {
    const exists = current.some(id => String(id) === String(item.id));
    if (exists) { setCartQuantities(q => { const next = { ...q }; delete next[String(item.id)]; return next; }); return current.filter(id => String(id) !== String(item.id)); }
    setCartQuantities(q => ({ ...q, [String(item.id)]: q[String(item.id)] || 1 }));
    return [...current, item.id];
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      // QR labels use a guest-safe public lookup so a customer can scan the
      // printed label and open the exact showroom product without needing to
      // sign in first. Only visible showroom-safe fields are returned.
      if (directQrCode) {
        const { data, error: qrError } = await supabase.rpc('public_lookup_showroom_product', { p_code: String(directQrCode) });
        if (qrError) throw qrError;
        const item = Array.isArray(data) ? data[0] : data;
        if (!item?.id) throw new Error('This QR code is not linked to a visible showroom product.');
        setItems([item]);
        setSelected(item);
        return;
      }

      const pageSize = 1000;
      const all = [];
      let from = 0;
      while (true) {
        const { data, error: err } = await supabase
          .from('showroom_items')
          .select('id,source_type,ean,article_no,name,brand,model,category,description,image_url,features,dimensions,sku_l,sku_w,sku_h,sku_dim_unit,sku_nw,sku_gw,sku_wt_unit,featured,featured_rank,visible,video_url,created_at')
          .eq('visible', true)
          .order('featured', { ascending: false })
          .order('featured_rank', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (err) throw err;
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      setItems(all);
    } catch (err) {
      setError(err?.message || 'Unable to load showroom products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    let cancelled = false;
    async function loadRecentOrderCount() {
      if (!session?.user?.id) { setRecentOrderCount(0); return; }
      const { count, error: historyError } = await supabase
        .from('showroom_orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_user_id', session.user.id);
      if (!cancelled) setRecentOrderCount(historyError ? 0 : Number(count || 0));
    }
    loadRecentOrderCount();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!directQrCode || !items.length || selected) return;
    const normalized = String(directQrCode).trim().toLowerCase().replace(/\s+/g, '');
    const found = items.find(item => [item.ean, item.article_no, item.model, item.id].filter(Boolean).some(v => String(v).trim().toLowerCase().replace(/\s+/g, '') === normalized));
    if (found) setSelected(found);
  }, [directQrCode, items, selected]);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== 'Escape') return;
      if (scannerOpen) return;
      if (selected) {
        event.preventDefault();
        closeDetail();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selected, scannerOpen]);

  const categories = useMemo(() => {
    const values = [...new Set(items.map(x => String(x.category || '').trim()).filter(Boolean))];
    return ['All', ...values].length > 1 ? ['All', ...values] : CATEGORY_FALLBACK;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(item => {
      if (collectionMode === 'favourites' && !isFavourite(item)) return false;
      if (collectionMode === 'cart' && !inCart(item)) return false;
      if (collectionMode === 'featured' && !item.featured) return false;
      if (category !== 'All' && String(item.category || '') !== category) return false;
      if (!q) return true;
      return [item.name, item.brand, item.model, item.category, item.ean, item.article_no].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    });
  }, [items, search, category]);

  // Featured products are the single curated homepage selection.
  // Ordering is controlled by featured_rank in Showroom Manager.
  const featured = useMemo(() => items
    .filter(x => x.featured && x.visible)
    .sort((a, b) => {
      const ar = Number.isFinite(Number(a.featured_rank)) ? Number(a.featured_rank) : 999999;
      const br = Number.isFinite(Number(b.featured_rank)) ? Number(b.featured_rank) : 999999;
      return ar - br || String(a.created_at || '').localeCompare(String(b.created_at || ''));
    }), [items]);

  function openItem(item, { pushHistory = true } = {}) {
    if (!item) return;
    if (pushHistory) pushShowroomHistory('detail');
    setSelected(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeDetail() {
    if (!popShowroomHistory('detail')) setSelected(null);
  }

  function openItemFromPopup(item) {
    const top = overlayHistoryRef.current[overlayHistoryRef.current.length - 1];
    if (top === 'popup') {
      overlayHistoryRef.current[overlayHistoryRef.current.length - 1] = 'detail';
      window.history.replaceState({ ...(window.history.state || {}), showroomOverlay: 'detail' }, '', window.location.href);
      setPopup(null);
      setSelected(item);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    openItem(item);
  }

  function openScanner() {
    if (!scannerOpen) pushShowroomHistory('scanner');
    setScannerOpen(true);
  }

  function closeScanner() {
    if (!popShowroomHistory('scanner')) setScannerOpen(false);
  }

  function openPopup(mode) {
    pushShowroomHistory('popup');
    setPopup(mode);
  }

  function closePopup() {
    if (!popShowroomHistory('popup')) setPopup(null);
  }

  function openOrderHistory() {
    pushShowroomHistory('order-history');
    setOrderHistoryOpen(true);
  }

  function closeOrderHistory() {
    if (!popShowroomHistory('order-history')) setOrderHistoryOpen(false);
  }

  async function lookupGuestCode(raw) {
    const { data, error: lookupError } = await supabase.rpc('public_lookup_showroom_product', { p_code: String(raw || '') });
    if (lookupError) {
      console.warn('Guest barcode lookup failed:', lookupError.message);
      return null;
    }
    const item = Array.isArray(data) ? data[0] : data;
    if (!item?.id) return null;
    setItems(current => current.some(existing => String(existing.id) === String(item.id)) ? current : [...current, item]);
    return item;
  }
  function handleScan(item) {
    if (!item) return;
    // Replace the scanner history layer with the product detail layer so the
    // next mobile back-swipe closes the detail page, not an already-closed scanner.
    const top = overlayHistoryRef.current[overlayHistoryRef.current.length - 1];
    if (top === 'scanner') {
      overlayHistoryRef.current[overlayHistoryRef.current.length - 1] = 'detail';
      window.history.replaceState({ ...(window.history.state || {}), showroomOverlay: 'detail' }, '', window.location.href);
    } else {
      pushShowroomHistory('detail');
    }
    setScannerOpen(false);
    openItem(item, { pushHistory: false });
  }

  if (selected) {
    return (
      <div className="showroom-app showroom-app-detail">
        <ShowroomHeader search={search} setSearch={value => { setSearch(value); setCollectionMode('all'); }} onScan={openScanner} onSignOut={signOut} favouriteCount={favouriteCount} cartCount={cartCount} onFavourites={() => openPopup('favourites')} onCart={() => openPopup('cart')} onOrders={openOrderHistory} orderCount={recentOrderCount} />
        <ProductDetail item={selected} onBack={closeDetail} onScanAnother={openScanner} isFavourite={isFavourite(selected)} inCart={inCart(selected)} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} />
        {scannerOpen && <ScannerModal products={items} onScan={handleScan} lookupCode={lookupGuestCode} onClose={closeScanner} />}
        {orderHistoryOpen && <OrderHistoryPopup onClose={closeOrderHistory} session={session} />}
      {popup && <SelectionPopup mode={popup} products={items} onClose={closePopup} onOpen={openItemFromPopup} isFavourite={isFavourite} inCart={inCart} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} cartQuantities={cartQuantities} setCartQuantities={setCartQuantities} customerProfile={profile} session={session} storagePrefix={storagePrefix} />}
      </div>
    );
  }

  return (
    <div className="showroom-app">
      <ShowroomHeader search={search} setSearch={value => { setSearch(value); setCollectionMode('all'); }} onScan={openScanner} onSignOut={signOut} favouriteCount={favouriteCount} cartCount={cartCount} onFavourites={() => openPopup('favourites')} onCart={() => openPopup('cart')} onOrders={openOrderHistory} orderCount={recentOrderCount} />
      <main className="showroom-main">
        <section className="showroom-hero">
          <div>
            <span className="showroom-hero-eyebrow">WELCOME TO THE SHOWROOM</span>
            <h1>Explore our products.</h1>
            <p>Browse the collection, discover product highlights, or scan the QR code on a display to open the product instantly.</p>
            <div className="showroom-hero-actions">
              <button type="button" className="showroom-primary-btn" onClick={openScanner}><QrIcon /> Scan product QR</button>
              <button type="button" className="showroom-outline-btn" onClick={() => document.getElementById('showroom-collection')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Browse collection</button>
            </div>
          </div>
          <div className="showroom-hero-orbit" aria-hidden="true"><div className="showroom-orbit-ring ring-1"/><div className="showroom-orbit-ring ring-2"/><div className="showroom-orbit-core">G</div></div>
        </section>

        {featured.length > 0 && (
          <section className={`showroom-featured-section ${featuredExpanded ? 'is-expanded' : ''}`} aria-label="Featured products">
            <div className="showroom-featured-heading">
              <div>
                <span>HANDPICKED</span>
                <h2>Featured products</h2>
              </div>
              <button
                type="button"
                className="showroom-featured-view-all"
                aria-expanded={featuredExpanded}
                onClick={() => {
                  const next = !featuredExpanded;
                  setFeaturedExpanded(next);
                  requestAnimationFrame(() => {
                    document.querySelector('.showroom-featured-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  });
                }}
              >
                {featuredExpanded ? <>View less <span className="showroom-featured-chevron showroom-featured-chevron-up" aria-hidden="true"><ChevronRightIcon /></span></> : <>View all <span className="showroom-featured-chevron showroom-featured-chevron-right" aria-hidden="true"><ChevronRightIcon /></span></>}
              </button>
            </div>
            {featuredExpanded ? (
              <div className="showroom-featured-expanded-grid">
                {featured.map(item => (
                  <article className="showroom-featured-expanded-item" key={item.id}>
                    <ProductCard item={item} onOpen={openItem} isFavourite={isFavourite(item)} inCart={inCart(item)} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} />
                  </article>
                ))}
              </div>
            ) : (
              <div className="showroom-featured-viewport">
                <div className={`showroom-featured-track ${featured.length <= 4 ? 'is-short' : ''}`}>
                  {[...featured, ...(featured.length > 4 ? featured : [])].map((item, index) => (
                    <article className="showroom-featured-slide" key={`${item.id}-${index}`}>
                      <ProductCard item={item} onOpen={openItem} isFavourite={isFavourite(item)} inCart={inCart(item)} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} />
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {items.filter(x => x.visible).length > 0 && (
          <section className="showroom-home-section showroom-new-arrivals" aria-label="New arrivals">
            <div className="showroom-block-heading showroom-home-section-heading"><div><span>JUST IN</span><h2>New arrivals</h2></div><div className="showroom-result-count">Latest additions</div></div>
            <div className="showroom-mini-grid">
              {items.filter(x => x.visible).slice().sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 4).map(item => <ProductCard key={`new-${item.id}`} item={item} onOpen={openItem} isFavourite={isFavourite(item)} inCart={inCart(item)} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} />)}
            </div>
          </section>
        )}

        {categories.filter(c => c !== 'All').length > 0 && (
          <section className="showroom-home-section showroom-category-showcase" aria-label="Shop by category">
            <div className="showroom-block-heading showroom-home-section-heading"><div><span>EXPLORE</span><h2>Shop by category</h2></div><div className="showroom-result-count">Choose a collection</div></div>
            <div className="showroom-category-tiles">
              {categories.filter(c => c !== 'All').slice(0, 8).map(cat => {
                const representative = items.find(x => x.visible && String(x.category || '') === String(cat) && getImage(x));
                const count = items.filter(x => x.visible && String(x.category || '') === String(cat)).length;
                return <button type="button" className="showroom-category-tile" key={cat} onClick={() => { setCollectionMode('all'); setSearch(''); setCategory(cat); requestAnimationFrame(() => document.getElementById('showroom-collection')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}>
                  <div className="showroom-category-tile-image">{representative ? <img src={getImage(representative)} alt="" loading="lazy" /> : <span>{String(cat).slice(0,1).toUpperCase()}</span>}</div>
                  <div><strong>{cat}</strong><small>{count} product{count === 1 ? '' : 's'}</small></div><ChevronRightIcon />
                </button>;
              })}
            </div>
          </section>
        )}

        <section className="showroom-section-block" id="showroom-collection">
          <div className="showroom-block-heading"><div><span>{collectionMode === 'favourites' ? 'YOUR SELECTION' : collectionMode === 'cart' ? 'YOUR CART' : collectionMode === 'featured' ? 'HANDPICKED' : 'COLLECTION'}</span><h2>{collectionMode === 'favourites' ? 'Favourite products' : collectionMode === 'cart' ? 'Cart' : collectionMode === 'featured' ? 'Featured products' : 'Browse products'}</h2></div><div className="showroom-result-count">{loading ? 'Loading…' : `${filtered.length} products`}</div></div>
          <div className="showroom-category-row">
            {categories.map(cat => <button key={cat} type="button" className={category === cat ? 'active' : ''} onClick={() => setCategory(cat)}>{cat}</button>)}
          </div>
          {error && <div className="showroom-error">{error}<button type="button" onClick={load}>Retry</button></div>}
          {loading ? <div className="showroom-empty-state"><div className="showroom-loader"/><p>Loading showroom collection…</p></div>
            : filtered.length ? <div className="showroom-product-grid">{filtered.map(item => <ProductCard key={item.id} item={item} onOpen={openItem} isFavourite={isFavourite(item)} inCart={inCart(item)} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} />)}</div>
            : <div className="showroom-empty-state"><div className="showroom-empty-icon">⌕</div><h3>No products found</h3><p>Try another search or category.</p></div>}
        </section>
      </main>
      <footer className="showroom-footer"><div>G-Records · Product Showroom</div><div>Guest access · Public product information only</div></footer>
      {scannerOpen && <ScannerModal products={items} onScan={handleScan} lookupCode={lookupGuestCode} onClose={closeScanner} />}
      {orderHistoryOpen && <OrderHistoryPopup onClose={closeOrderHistory} session={session} />}
      {popup && <SelectionPopup mode={popup} products={items} onClose={closePopup} onOpen={openItemFromPopup} isFavourite={isFavourite} inCart={inCart} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} cartQuantities={cartQuantities} setCartQuantities={setCartQuantities} customerProfile={profile} session={session} storagePrefix={storagePrefix} />}
    </div>
  );
}
