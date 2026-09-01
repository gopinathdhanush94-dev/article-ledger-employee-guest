import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import ScannerModal from './ScannerModal.jsx';
import { useAuth } from '../lib/useAuth.js';

const CATEGORY_FALLBACK = ['All', 'Beauty', 'Home', 'Kitchen', 'Garments', 'Travel'];
const FAV_KEY = 'g-records-showroom-favourites';
const CART_KEY = 'g-records-showroom-cart';

function getImage(item) { return item?.image_url || ''; }
function displayName(item) { return item?.name || item?.model || item?.article_no || 'Untitled Product'; }

function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6" /><path d="M16 16l5 5" /></svg>; }
function QrIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 14h2v2h-2zM19 14h1v6h-5v-2h4zM14 19h2v1h-2z" /></svg>; }
function ArrowIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>; }
function HeartIcon({ filled = false }) { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.7c0 5.1-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" fill={filled ? 'currentColor' : 'none'} /></svg>; }
function CartIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2l1.7 9.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7"/><circle cx="10" cy="19" r="1.2"/><circle cx="18" cy="19" r="1.2"/></svg>; }
function MinusIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>; }
function PlusIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>; }
function CloseIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>; }

function ShowroomHeader({ search, setSearch, onScan, onSignOut, favouriteCount = 0, cartCount = 0, onFavourites, onCart }) {
  return (
    <header className="showroom-header">
      <div className="showroom-brand-lockup"><div className="showroom-mark">G</div><div><div className="showroom-brand-eyebrow">G-RECORDS</div><div className="showroom-brand-title">Product Showroom</div></div></div>
      <div className="showroom-header-actions">
        <div className="showroom-search"><SearchIcon /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" aria-label="Search showroom products" /></div>
        <button className="showroom-scan-btn" type="button" onClick={onScan}><QrIcon /><span>Scan</span></button>
        <button className="showroom-icon-btn" type="button" onClick={onFavourites} aria-label={`Favourites${favouriteCount ? `, ${favouriteCount} items` : ''}`} title="Favourites"><HeartIcon filled={favouriteCount > 0} />{favouriteCount > 0 && <span className="showroom-count-badge">{favouriteCount}</span>}</button>
        <button className="showroom-icon-btn" type="button" onClick={onCart} aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`} title="Cart"><CartIcon />{cartCount > 0 && <span className="showroom-count-badge">{cartCount}</span>}</button>
        <button className="showroom-guest-btn" type="button" onClick={onSignOut}>Guest</button>
      </div>
    </header>
  );
}

function ProductCard({ item, onOpen, isFavourite, inCart, onToggleFavourite, onToggleCart }) {
  return (
    <article className="showroom-product-card">
      <button type="button" className="showroom-product-card-main" onClick={() => onOpen(item)} aria-label={`View ${displayName(item)}`}>
        <div className="showroom-product-image-wrap">{getImage(item) ? <img src={getImage(item)} alt="" loading="lazy" /> : <div className="showroom-image-fallback">{String(item?.category || 'PRODUCT').slice(0, 1).toUpperCase()}</div>}{item.featured && <span className="showroom-featured-pill">Featured</span>}</div>
        <div className="showroom-product-card-body"><div className="showroom-product-category">{item.category || item.source_type}</div><h3>{displayName(item)}</h3><p>{[item.model, item.ean ? `EAN: ${item.ean}` : ''].filter(Boolean).join(' · ') || 'Product details'}</p><span className="showroom-view-link">View details <ArrowIcon /></span></div>
      </button>
      <div className="showroom-card-actions">
        <button type="button" className={`showroom-card-action ${isFavourite ? 'active' : ''}`} onClick={() => onToggleFavourite(item)} aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}><HeartIcon filled={isFavourite} /> {isFavourite ? 'Favourited' : 'Favourite'}</button>
        <button type="button" className={`showroom-card-action ${inCart ? 'active' : ''}`} onClick={() => onToggleCart(item)} aria-label={inCart ? 'Remove from cart' : 'Add to cart'}><CartIcon /> {inCart ? 'In cart' : 'Add to cart'}</button>
      </div>
    </article>
  );
}

function getGallery(item) {
  const candidates = [item?.image_url, ...(Array.isArray(item?.images) ? item.images : []), ...(Array.isArray(item?.image_urls) ? item.image_urls : [])];
  return [...new Set(candidates.filter(Boolean).map(String))];
}
function formatNumber(value) { if (value === null || value === undefined || value === '') return ''; const n = Number(value); return Number.isFinite(n) ? String(n) : String(value); }
function skuDimensions(item) { const values = [item?.sku_l, item?.sku_w, item?.sku_h]; if (!values.some(v => v !== null && v !== undefined && v !== '')) return ''; const unit = item?.sku_dim_unit ? ` ${item.sku_dim_unit}` : ''; return `${values.map(v => formatNumber(v) || '—').join(' × ')}${unit}`; }
function skuWeight(item, net = true) { const value = net ? item?.sku_nw : item?.sku_gw; if (value === null || value === undefined || value === '') return ''; return `${formatNumber(value)}${item?.sku_wt_unit ? ` ${item.sku_wt_unit}` : ''}`; }
function money(value) { const n = Number(value); return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'; }

function ModalShell({ title, subtitle, onClose, children, className = '' }) {
  useEffect(() => { const handler = e => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }; document.addEventListener('keydown', handler, true); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', handler, true); document.body.style.overflow = prev; }; }, [onClose]);
  return <div className={`showroom-overlay ${className}`} role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="showroom-popup"><div className="showroom-popup-header"><div><div className="showroom-popup-kicker">G-RECORDS</div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="showroom-popup-close" type="button" onClick={onClose} aria-label="Close"><CloseIcon /></button></div>{children}</div></div>;
}

function FavouritesModal({ items, favourites, cart, onToggleFavourite, onToggleCart, onOpenProduct, onClose }) {
  const selected = items.filter(x => favourites.includes(x.id));
  return <ModalShell title="Favourite products" subtitle={`${selected.length} selected product${selected.length === 1 ? '' : 's'}`} onClose={onClose}>
    {selected.length === 0 ? <div className="showroom-popup-empty"><HeartIcon /><h3>No favourites yet</h3><p>Use the heart button on a product to save it here.</p></div> : <div className="showroom-selection-list">{selected.map(item => <div className="showroom-selection-row" key={item.id}>
      <button type="button" className="showroom-selection-product" onClick={() => { onClose(); onOpenProduct(item); }}><div className="showroom-selection-thumb">{getImage(item) ? <img src={getImage(item)} alt="" /> : <span>{String(item.category || 'P').slice(0, 1)}</span>}</div><div><strong>{displayName(item)}</strong><span>{item.ean ? `EAN: ${item.ean}` : item.model || item.category || 'Product'}</span></div></button>
      <div className="showroom-selection-actions"><button type="button" className="showroom-small-icon-btn active" onClick={() => onToggleFavourite(item)} aria-label="Remove from favourites" title="Remove from favourites"><HeartIcon filled /></button><button type="button" className={`showroom-small-icon-btn ${cart.includes(item.id) ? 'active' : ''}`} onClick={() => onToggleCart(item)} aria-label={cart.includes(item.id) ? 'Remove from cart' : 'Add to cart'} title={cart.includes(item.id) ? 'Remove from cart' : 'Add to cart'}><CartIcon /></button></div>
    </div>)}</div>}
  </ModalShell>;
}

function CartModal({ items, cart, setCart, onClose, onOpenProduct, onSubmitOrder }) {
  const [step, setStep] = useState('cart');
  const [leadPeriod, setLeadPeriod] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const lines = cart.map(line => ({ ...line, item: items.find(x => x.id === line.id) })).filter(x => x.item);
  const total = lines.reduce((sum, line) => sum + (Number(line.item.mrp) || 0) * line.quantity, 0);
  const quantityTotal = lines.reduce((sum, line) => sum + line.quantity, 0);
  const updateQty = (id, quantity) => setCart(current => current.map(line => line.id === id ? { ...line, quantity: Math.max(1, Math.min(9999, quantity)) } : line));
  const remove = id => setCart(current => current.filter(line => line.id !== id));
  const preview = () => { if (!lines.length) return; setSubmitError(''); setStep('preview'); };
  const submit = async () => { setSubmitting(true); setSubmitError(''); const result = await onSubmitOrder({ lines, total, leadPeriod, requiredDate, comments }); if (result?.error) setSubmitError(result.error); else setSubmittedOrder(result.order || { request_no: 'Submitted' }); setSubmitting(false); };
  return <ModalShell title={step === 'cart' ? 'Your cart' : 'Preview order'} subtitle={step === 'cart' ? `${lines.length} product${lines.length === 1 ? '' : 's'} · ${quantityTotal} unit${quantityTotal === 1 ? '' : 's'}` : 'Review everything before submitting'} onClose={onClose} className="showroom-cart-modal">
    {submittedOrder ? <div className="showroom-order-success"><div className="showroom-success-icon">✓</div><h3>Order submitted</h3><p>Your showroom order has been submitted successfully.</p><strong>{submittedOrder.request_no}</strong><button type="button" className="showroom-primary-btn" onClick={onClose}>Done</button></div> : !lines.length ? <div className="showroom-popup-empty"><CartIcon /><h3>Your cart is empty</h3><p>Add products from the showroom to build an order.</p></div> : step === 'cart' ? <>
      <div className="showroom-cart-lines">{lines.map(line => <div className="showroom-cart-line" key={line.id}>
        <button type="button" className="showroom-cart-product" onClick={() => { onClose(); onOpenProduct(line.item); }}><div className="showroom-selection-thumb">{getImage(line.item) ? <img src={getImage(line.item)} alt="" /> : <span>{String(line.item.category || 'P').slice(0, 1)}</span>}</div><div><strong>{displayName(line.item)}</strong><span>{line.item.ean ? `EAN: ${line.item.ean}` : line.item.model || line.item.category || ''}</span></div></button>
        <div className="showroom-qty-control"><button type="button" onClick={() => updateQty(line.id, line.quantity - 1)} disabled={line.quantity <= 1} aria-label="Decrease quantity"><MinusIcon /></button><input type="number" min="1" max="9999" value={line.quantity} onChange={e => updateQty(line.id, Number(e.target.value) || 1)} aria-label={`Quantity for ${displayName(line.item)}`} /><button type="button" onClick={() => updateQty(line.id, line.quantity + 1)} aria-label="Increase quantity"><PlusIcon /></button></div>
        <div className="showroom-cart-price"><span>{money(line.item.mrp)} × {line.quantity}</span><strong>{money((Number(line.item.mrp) || 0) * line.quantity)}</strong></div>
        <button type="button" className="showroom-remove-btn" onClick={() => remove(line.id)} aria-label={`Remove ${displayName(line.item)} from cart`} title="Remove from cart"><CloseIcon /></button>
      </div>)}</div>
      <div className="showroom-cart-total"><span>Total MRP</span><strong>{money(total)}</strong><small>Order total is calculated using MRP only, not selling price.</small></div>
      <div className="showroom-order-form"><div className="showroom-form-grid"><label>Lead period<input value={leadPeriod} onChange={e => setLeadPeriod(e.target.value)} placeholder="e.g. 7 days" /></label><label>Required date<input type="date" value={requiredDate} onChange={e => setRequiredDate(e.target.value)} /></label></div><label>Comments<textarea value={comments} onChange={e => setComments(e.target.value)} rows="3" placeholder="Add comments related to this order…" /></label></div>
      <div className="showroom-popup-footer"><button type="button" className="showroom-outline-btn" onClick={onClose}>Continue browsing</button><button type="button" className="showroom-primary-btn" onClick={preview}>Preview order</button></div>
    </> : <>
      <div className="showroom-preview-card"><div className="showroom-preview-heading"><strong>Order summary</strong><span>{lines.length} products</span></div>{lines.map(line => <div className="showroom-preview-line" key={line.id}><div><strong>{displayName(line.item)}</strong><span>{line.quantity} × {money(line.item.mrp)} MRP</span></div><strong>{money((Number(line.item.mrp) || 0) * line.quantity)}</strong></div>)}<div className="showroom-preview-total"><span>Total MRP</span><strong>{money(total)}</strong></div></div>
      <div className="showroom-preview-meta"><div><span>Lead period</span><strong>{leadPeriod || '—'}</strong></div><div><span>Required date</span><strong>{requiredDate || '—'}</strong></div><div className="full"><span>Comments</span><strong>{comments || '—'}</strong></div></div>
      {submitError && <div className="showroom-submit-error">{submitError}</div>}
      <div className="showroom-popup-footer"><button type="button" className="showroom-outline-btn" onClick={() => setStep('cart')} disabled={submitting}>Edit order</button><button type="button" className="showroom-primary-btn" onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit order'}</button></div>
    </>}
  </ModalShell>;
}

function ProductDetail({ item, onBack, onScanAnother, isFavourite, inCart, onToggleFavourite, onToggleCart }) {
  const gallery = getGallery(item); const [imageOpen, setImageOpen] = useState(false); const [activeImage, setActiveImage] = useState(0); const highlights = Array.isArray(item?.features) ? item.features : [];
  useEffect(() => { if (!imageOpen) return undefined; const onKeyDown = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setImageOpen(false); } }; document.addEventListener('keydown', onKeyDown, true); const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', onKeyDown, true); document.body.style.overflow = previousOverflow; }; }, [imageOpen]);
  const currentImage = gallery[activeImage] || '';
  return <div className="showroom-detail-page">
    <button className="showroom-back" type="button" onClick={onBack}>← Back to showroom</button>
    <div className="showroom-detail-shell"><div className="showroom-detail-media-area"><div className="showroom-detail-media showroom-detail-media-compact" onClick={() => currentImage && setImageOpen(true)} role={currentImage ? 'button' : undefined} tabIndex={currentImage ? 0 : undefined} onKeyDown={e => { if (currentImage && (e.key === 'Enter' || e.key === ' ')) setImageOpen(true); }}>{currentImage ? <img src={currentImage} alt={displayName(item)} /> : <div className="showroom-detail-fallback">{String(item?.category || 'PRODUCT').slice(0, 1).toUpperCase()}</div>}{currentImage && <div className="showroom-image-hint">Click image to enlarge</div>}</div>{gallery.length > 0 && <div className="showroom-thumbnail-strip" aria-label="Product images">{gallery.map((src, index) => <button key={`${src}-${index}`} type="button" className={`showroom-thumbnail ${activeImage === index ? 'active' : ''}`} onClick={() => setActiveImage(index)} aria-label={`View product image ${index + 1}`}><img src={src} alt="" /></button>)}</div>}</div>
      <div className="showroom-detail-main"><div className="showroom-detail-kicker">{item.category || 'PRODUCT'}</div><h1>{displayName(item)}</h1><p className="showroom-detail-subtitle">{item.model || 'Product details'}</p><div className="showroom-detail-top-actions"><button type="button" className={`showroom-detail-icon-btn ${isFavourite ? 'active' : ''}`} onClick={() => onToggleFavourite(item)} aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'} title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}><HeartIcon filled={isFavourite} /></button><button type="button" className={`showroom-detail-icon-btn ${inCart ? 'active' : ''}`} onClick={() => onToggleCart(item)} aria-label={inCart ? 'Remove from cart' : 'Add to cart'} title={inCart ? 'Remove from cart' : 'Add to cart'}><CartIcon /></button><button type="button" className="showroom-detail-icon-btn" onClick={onScanAnother} aria-label="Scan another product" title="Scan another product"><QrIcon /></button></div>
        <section className="showroom-section showroom-sku-section"><div className="showroom-section-title">SKU details</div><div className="showroom-sku-grid">{[['EAN', item.ean], ['Model', item.model], ['Category', item.category], ['L × B × H', skuDimensions(item)], ['Net weight', skuWeight(item, true)], ['Gross weight', skuWeight(item, false)]].map(([label, value]) => <div className="showroom-sku-item" key={label}><span>{label}</span><strong>{value || '—'}</strong></div>)}</div></section>
        {(item.description || highlights.length) && <section className="showroom-section"><div className="showroom-section-title">About this product</div>{item.description && <p className="showroom-description">{item.description}</p>}{highlights.length > 0 && <div className="showroom-feature-list">{highlights.map((feature, i) => <span key={i}>✓ {feature}</span>)}</div>}</section>}
      </div></div>
    {imageOpen && currentImage && <div className="showroom-image-viewer" role="dialog" aria-modal="true" aria-label="Product image viewer" onClick={() => setImageOpen(false)}><button type="button" className="showroom-image-close" onClick={e => { e.stopPropagation(); setImageOpen(false); }} aria-label="Close image viewer"><CloseIcon /></button><div className="showroom-image-viewer-content" onClick={e => e.stopPropagation()}><img className="showroom-image-viewer-main" src={currentImage} alt={displayName(item)} />{gallery.length > 0 && <div className="showroom-image-viewer-thumbs">{gallery.map((src, index) => <button key={`${src}-${index}`} type="button" className={`showroom-thumbnail ${activeImage === index ? 'active' : ''}`} onClick={() => setActiveImage(index)} aria-label={`View product image ${index + 1}`}><img src={src} alt="" /></button>)}</div>}</div></div>}
  </div>;
}

function readFavourites() { try { const value = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function readCart() { try { const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); if (!Array.isArray(value)) return []; return value.map(v => typeof v === 'object' && v ? { id: v.id, quantity: Math.max(1, Number(v.quantity) || 1) } : { id: v, quantity: 1 }).filter(v => v.id); } catch { return []; } }

export default function GuestShowroom() {
  const { signOut } = useAuth();
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [category, setCategory] = useState('All'); const [selected, setSelected] = useState(null); const [scannerOpen, setScannerOpen] = useState(false); const [collectionMode, setCollectionMode] = useState('all'); const [favourites, setFavourites] = useState(readFavourites); const [cart, setCart] = useState(readCart); const [popup, setPopup] = useState(null);
  useEffect(() => localStorage.setItem(FAV_KEY, JSON.stringify(favourites)), [favourites]);
  useEffect(() => localStorage.setItem(CART_KEY, JSON.stringify(cart)), [cart]);
  const isFavourite = item => favourites.includes(item.id); const cartLine = item => cart.find(line => line.id === item.id); const inCart = item => !!cartLine(item);
  const toggleFavourite = item => setFavourites(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]);
  const toggleCart = item => setCart(current => current.some(line => line.id === item.id) ? current.filter(line => line.id !== item.id) : [...current, { id: item.id, quantity: 1 }]);
  const load = async () => { setLoading(true); const { data, error: err } = await supabase.from('showroom_items').select('id,source_type,ean,article_no,name,brand,model,category,description,image_url,features,sku_l,sku_w,sku_h,sku_dim_unit,sku_nw,sku_gw,sku_wt_unit,mrp,featured,visible').eq('visible', true).order('featured', { ascending: false }).order('created_at', { ascending: false }); if (err) setError(err.message || 'Unable to load showroom products'); else setItems(data || []); setLoading(false); };
  useEffect(() => { load(); }, []);
  useEffect(() => { const params = new URLSearchParams(window.location.search); const code = params.get('product') || params.get('ean') || params.get('qr'); if (!code || !items.length) return; const normalized = String(code).trim().toLowerCase().replace(/\s+/g, ''); const found = items.find(item => [item.ean, item.article_no, item.model, item.id].filter(Boolean).some(v => String(v).trim().toLowerCase().replace(/\s+/g, '') === normalized)); if (found) setSelected(found); }, [items]);
  useEffect(() => { const onKeyDown = event => { if (event.key !== 'Escape') return; if (scannerOpen || popup) return; if (selected) { event.preventDefault(); setSelected(null); } }; document.addEventListener('keydown', onKeyDown); return () => document.removeEventListener('keydown', onKeyDown); }, [selected, scannerOpen, popup]);
  const categories = useMemo(() => { const values = [...new Set(items.map(x => String(x.category || '').trim()).filter(Boolean))]; return ['All', ...values].length > 1 ? ['All', ...values] : CATEGORY_FALLBACK; }, [items]);
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return items.filter(item => { if (collectionMode === 'favourites' && !isFavourite(item)) return false; if (collectionMode === 'cart' && !inCart(item)) return false; if (category !== 'All' && String(item.category || '') !== category) return false; if (!q) return true; return [item.name, item.brand, item.model, item.category, item.ean].filter(Boolean).some(v => String(v).toLowerCase().includes(q)); }); }, [items, search, category, collectionMode, favourites, cart]);
  const featured = useMemo(() => items.filter(x => x.featured).slice(0, 4), [items]);
  function openItem(item) { setSelected(item); setPopup(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function openScanner() { setScannerOpen(true); } function handleScan(item) { setScannerOpen(false); openItem(item); }
  async function submitOrder({ lines, total, leadPeriod, requiredDate, comments }) {
    const { data: authData } = await supabase.auth.getUser(); const userId = authData?.user?.id;
    if (!userId) return { error: 'Guest session is not available. Please refresh and try again.' };
    const { data: order, error: orderError } = await supabase.from('showroom_order_requests').insert({ created_by: userId, lead_period: leadPeriod || null, required_date: requiredDate || null, comments: comments || null, total_mrp: total }).select('id,request_no').single();
    if (orderError) return { error: orderError.message || 'Unable to submit order' };
    const rows = lines.map(line => ({ order_id: order.id, showroom_item_id: line.id, product_name: displayName(line.item), ean: line.item.ean || null, model: line.item.model || null, mrp: Number(line.item.mrp) || 0, quantity: line.quantity, line_total: (Number(line.item.mrp) || 0) * line.quantity }));
    const { error: itemError } = await supabase.from('showroom_order_items').insert(rows);
    if (itemError) { await supabase.from('showroom_order_requests').delete().eq('id', order.id); return { error: itemError.message || 'Unable to save order items' }; }
    setCart([]); return { order };
  }
  const openFavourites = () => setPopup('favourites'); const openCart = () => setPopup('cart');
  if (selected) return <div className="showroom-app showroom-app-detail"><ShowroomHeader search={search} setSearch={value => { setSearch(value); setCollectionMode('all'); }} onScan={openScanner} onSignOut={signOut} favouriteCount={favourites.length} cartCount={cart.length} onFavourites={openFavourites} onCart={openCart} /><ProductDetail item={selected} onBack={() => setSelected(null)} onScanAnother={openScanner} isFavourite={isFavourite(selected)} inCart={inCart(selected)} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} />{scannerOpen && <ScannerModal products={items} onScan={handleScan} onClose={() => setScannerOpen(false)} />}{popup === 'favourites' && <FavouritesModal items={items} favourites={favourites} cart={cart.map(x => x.id)} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} onOpenProduct={openItem} onClose={() => setPopup(null)} />}{popup === 'cart' && <CartModal items={items} cart={cart} setCart={setCart} onClose={() => setPopup(null)} onOpenProduct={openItem} onSubmitOrder={submitOrder} />}</div>;
  return <div className="showroom-app"><ShowroomHeader search={search} setSearch={value => { setSearch(value); setCollectionMode('all'); }} onScan={openScanner} onSignOut={signOut} favouriteCount={favourites.length} cartCount={cart.length} onFavourites={openFavourites} onCart={openCart} /><main className="showroom-main"><section className="showroom-hero"><div><span className="showroom-hero-eyebrow">WELCOME TO THE SHOWROOM</span><h1>Explore our products.</h1><p>Browse the collection, discover product highlights, or scan the QR code on a display to open the product instantly.</p><div className="showroom-hero-actions"><button type="button" className="showroom-primary-btn" onClick={openScanner}><QrIcon /> Scan product QR</button><button type="button" className="showroom-outline-btn" onClick={() => window.scrollTo({ top: 520, behavior: 'smooth' })}>Browse collection</button></div></div><div className="showroom-hero-orbit" aria-hidden="true"><div className="showroom-orbit-ring ring-1"/><div className="showroom-orbit-ring ring-2"/><div className="showroom-orbit-core">G</div></div></section>{featured.length > 0 && <section className="showroom-section-block"><div className="showroom-block-heading"><div><span>HANDPICKED</span><h2>Featured products</h2></div><button type="button" onClick={() => setSearch('')}>View all <ArrowIcon /></button></div><div className="showroom-featured-grid">{featured.map(item => <ProductCard key={item.id} item={item} onOpen={openItem} isFavourite={isFavourite(item)} inCart={inCart(item)} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} />)}</div></section>}<section className="showroom-section-block" id="showroom-collection"><div className="showroom-block-heading"><div><span>{collectionMode === 'favourites' ? 'YOUR SELECTION' : collectionMode === 'cart' ? 'YOUR CART' : 'COLLECTION'}</span><h2>{collectionMode === 'favourites' ? 'Favourite products' : collectionMode === 'cart' ? 'Cart' : 'Browse products'}</h2></div><div className="showroom-result-count">{loading ? 'Loading…' : `${filtered.length} products`}</div></div><div className="showroom-category-row">{categories.map(cat => <button key={cat} type="button" className={category === cat ? 'active' : ''} onClick={() => setCategory(cat)}>{cat}</button>)}</div>{error && <div className="showroom-error">{error}<button type="button" onClick={load}>Retry</button></div>}{loading ? <div className="showroom-empty-state"><div className="showroom-loader"/><p>Loading showroom collection…</p></div> : filtered.length ? <div className="showroom-product-grid">{filtered.map(item => <ProductCard key={item.id} item={item} onOpen={openItem} isFavourite={isFavourite(item)} inCart={inCart(item)} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} />)}</div> : <div className="showroom-empty-state"><div className="showroom-empty-icon">⌕</div><h3>No products found</h3><p>Try another search or category.</p></div>}</section></main><footer className="showroom-footer"><div>G-Records · Product Showroom</div><div>Guest access · Public product information only</div></footer>{scannerOpen && <ScannerModal products={items} onScan={handleScan} onClose={() => setScannerOpen(false)} />}{popup === 'favourites' && <FavouritesModal items={items} favourites={favourites} cart={cart.map(x => x.id)} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} onOpenProduct={openItem} onClose={() => setPopup(null)} />}{popup === 'cart' && <CartModal items={items} cart={cart} setCart={setCart} onClose={() => setPopup(null)} onOpenProduct={openItem} onSubmitOrder={submitOrder} />}</div>;
}
