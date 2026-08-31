import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient.js';
import { fmtINR, discountPct, formatMonthLabel } from '../lib/helpers.js';

function dims(l, w, h, unit) {
  return (l ?? w ?? h) !== undefined && (l ?? w ?? h) !== null && (l || w || h)
    ? `${l ?? '—'} × ${w ?? '—'} × ${h ?? '—'} ${(unit || 'CM').toLowerCase()}`
    : '—';
}
function wt(nw, gw, unit) {
  if (nw == null && gw == null) return '—';
  const u = (unit || 'KG').toLowerCase();
  return `N.W ${nw ?? '—'} ${u} · G.W ${gw ?? '—'} ${u}`;
}
function formatWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

const FIELD_LABELS = {
  ean: 'EAN Code', hsn: 'HSN Code', mrp: 'MRP', sp: 'Selling Price',
  master_qty: 'Master Ctn Qty', inner_qty: 'Inner Ctn Qty',
  master_l: 'Master Length', master_w: 'Master Width', master_h: 'Master Height',
  inner_l: 'Inner Length', inner_w: 'Inner Width', inner_h: 'Inner Height',
  description: 'Description', brand: 'Brand', category: 'Category', model: 'Model',
  article_no: 'Article No.', marketed_by: 'Marketed By', month: 'Month'
};

function cartonMrp(qty, mrp) {
  const q = Number(qty), m = Number(mrp);
  return Number.isFinite(q) && Number.isFinite(m) ? fmtINR(q * m) : '—';
}

function Icon({ children, tone = 'blue' }) {
  return <span className={`pd-icon pd-icon-${tone}`} aria-hidden="true">{children}</span>;
}

function DataItem({ icon, label, value, tone = 'blue', className = '' }) {
  return (
    <div className={`pd-data-item ${className}`}>
      {icon ? <Icon tone={tone}>{icon}</Icon> : null}
      <div className="pd-data-copy">
        <small>{label}</small>
        <strong title={value ?? '—'}>{value ?? '—'}</strong>
      </div>
    </div>
  );
}

function CartonSection({ type, tone, qty, mrp, unitMrp, dimensions, weight }) {
  const isMaster = type === 'MASTER CARTON';
  return (
    <section className={`pd-carton-section pd-carton-${tone}`}>
      <div className="pd-carton-header">
        <div className="pd-carton-title">
          <Icon tone={tone}>{isMaster ? '▣' : '◇'}</Icon>
          <strong>{type}</strong>
        </div>
        <span className="pd-carton-badge">{isMaster ? 'MASTER' : 'INNER'}</span>
      </div>
      <div className="pd-carton-row">
        <DataItem icon="▣" tone={tone} label="QUANTITY" value={qty ?? '—'} />
        <div className="pd-data-item pd-carton-mrp">
          <Icon tone={tone}>₹</Icon>
          <div className="pd-data-copy">
            <small>{isMaster ? 'MASTER CARTON MRP' : 'INNER CARTON MRP'}</small>
            <strong title={mrp}>{mrp}</strong>
            {qty != null && unitMrp != null && <span className="pd-carton-formula">{qty} × {fmtINR(unitMrp)}</span>}
          </div>
        </div>
        <DataItem icon="⌗" tone={tone} label="DIMENSIONS (L × W × H)" value={dimensions} />
        <DataItem icon="◉" tone={tone} label="NET / GROSS WEIGHT" value={weight} className="pd-weight-item" />
      </div>
    </section>
  );
}

export default function ProductModal({ product: p, isAuthed, onClose, onEdit, onDelete, onPrev, onNext }) {
  const off = discountPct(p.mrp, p.sp);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);

  // Lock the catalogue while the modal is open without disabling touch scrolling
  // on the modal itself. Android works best with overflow locking only; iOS
  // additionally gets the fixed-body technique to prevent Safari background drift.
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyTouchAction: body.style.touchAction,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };

    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'auto';

    if (isIOS) {
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.width = '100%';
    }

    body.classList.add('product-modal-open');

    return () => {
      body.classList.remove('product-modal-open');
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      body.style.touchAction = previous.bodyTouchAction;
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      if (isIOS) window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    if (!showImageViewer) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowImageViewer(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showImageViewer]);

  useEffect(() => {
    if (!isAuthed || !p?.id) { setHistory([]); return; }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    supabase.from('product_field_changes').select('*').eq('product_id', p.id).order('changed_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setHistoryError(error.message); setHistory([]); }
        else setHistory(data || []);
        setHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [p?.id, isAuthed]);

  const sellingPrice = p.sp != null ? fmtINR(p.sp) : (p.mrp != null ? fmtINR(p.mrp) : '—');
  const masterMrp = cartonMrp(p.master_qty, p.mrp);
  const innerMrp = cartonMrp(p.inner_qty, p.mrp);

  return (
    <div className="overlay product-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="product-modal-shell pd-shell">
        {onPrev && <button className="modal-nav-btn prev" onClick={onPrev} title="Previous">‹</button>}
        <div className="modal product-modal product-modal-compact pd-modal" onMouseDown={e => e.stopPropagation()}>
          <button className="modal-close pd-close" onClick={onClose} aria-label="Close">✕</button>

          <div className="pd-layout">
            <aside className="pd-sidebar">
              <div className="pd-image-card">
                {p.image_url
                  ? <button type="button" className="pd-image-button" onClick={() => setShowImageViewer(true)} aria-label="View product image larger">
                      <img src={p.image_url} alt={p.description || 'Product'} />
                    </button>
                  : <div className="image-placeholder-large"><span>NO IMAGE</span><small>Upload an image from Edit</small></div>}
              </div>

              <div className="pd-sidebar-meta">
                <DataItem icon="▦" tone="teal" label="CATEGORY" value={p.category || 'Uncategorized'} />
                <DataItem icon="◇" tone="purple" label="BRAND" value={p.brand || 'No brand'} />
                <DataItem icon="□" tone="blue" label="MODEL" value={p.model || '—'} />
                <DataItem icon="♙" tone="orange" label="MARKETED BY" value={p.marketed_by || '—'} />
              </div>
            </aside>

            <main className="pd-main">
              <header className="pd-header">
                <div className="pd-title-area">
                  <span className="cat-tag">{p.category || 'Uncategorized'}</span>
                  <h2>{p.description || p.model || 'Unnamed article'}</h2>
                  <div>{p.brand || 'No brand'} {p.model && <span>· {p.model}</span>}</div>
                </div>
                <div className="pd-price-area">
                  <span className="pd-selling-price">{sellingPrice}</span>
                  <div className="pd-price-meta">
                    <span>MRP</span>
                    <del>{p.mrp != null ? fmtINR(p.mrp) : '—'}</del>
                    {off ? <span className="off-badge">{off}% OFF</span> : null}
                  </div>
                </div>
              </header>

              <div className="pd-content">
                <div className="pd-identifier-strip">
                  <DataItem icon="▥" tone="blue" label="EAN" value={p.ean} />
                  <DataItem icon="◇" tone="purple" label="ARTICLE NO." value={p.article_no} />
                  <DataItem icon="▣" tone="green" label="PI MONTH" value={formatMonthLabel(p.month)} />
                  <DataItem icon="#" tone="orange" label="HSN" value={p.hsn} />
                </div>

                <section className="pd-section">
                  <h3>COMMERCIAL</h3>
                  <div className="pd-commercial-strip">
                    <DataItem icon="◇" tone="red" label="MRP" value={p.mrp != null ? fmtINR(p.mrp) : '—'} />
                    <DataItem icon="₹" tone="teal" label="SELLING PRICE" value={sellingPrice} />
                    <DataItem icon="%" tone="orange" label="DISCOUNT" value={off ? `${off}%` : '—'} />
                  </div>
                </section>

                <section className="pd-section pd-packaging">
                  <div className="pd-section-heading">
                    <h3>PACKAGING &amp; LOGISTICS</h3>
                  </div>
                  <CartonSection
                    type="MASTER CARTON" tone="teal"
                    qty={p.master_qty} mrp={masterMrp} unitMrp={p.mrp}
                    dimensions={dims(p.master_l, p.master_w, p.master_h, p.master_dim_unit)}
                    weight={wt(p.master_nw, p.master_gw, p.master_wt_unit)}
                  />
                  <CartonSection
                    type="INNER CARTON" tone="purple"
                    qty={p.inner_qty} mrp={innerMrp} unitMrp={p.mrp}
                    dimensions={dims(p.inner_l, p.inner_w, p.inner_h, p.inner_dim_unit)}
                    weight={wt(p.inner_nw, p.inner_gw, p.inner_wt_unit)}
                  />
                </section>

                <section className="pd-section pd-sku-section">
                  <h3>SKU / UNIT DETAILS</h3>
                  <div className="pd-sku-row">
                    <DataItem icon="↗" tone="blue" label="SKU DIMENSIONS (L × W × H)" value={dims(p.sku_l, p.sku_w, p.sku_h, p.sku_dim_unit)} />
                    <DataItem icon="◉" tone="blue" label="SKU NET / GROSS WEIGHT" value={wt(p.sku_nw, p.sku_gw, p.sku_wt_unit)} />
                  </div>
                </section>
              </div>

              <footer className="pd-actions">
                {onEdit && <button className="btn btn-primary" onClick={onEdit}>✎&nbsp; Edit Article</button>}
                {isAuthed && <button className="btn btn-secondary" onClick={() => setShowHistory(v => !v)}>◷&nbsp; History {history.length > 0 && <span>({history.length})</span>}</button>}
                {onDelete && <button className="btn btn-danger" onClick={onDelete}>♲&nbsp; Delete</button>}
              </footer>

              {showHistory && (
                <div className="history-popover pd-history-panel">
                  {!isAuthed ? <div className="inline-notice">Sign in to view the product change history.</div> :
                    historyLoading ? <div className="quality-empty">Loading history…</div> :
                    historyError ? <div className="inline-notice danger">Could not load history: {historyError}</div> :
                    history.length === 0 ? <div className="quality-empty">No changes recorded yet.</div> :
                    <div className="history-timeline">{history.slice(0, 8).map(h => (
                      <div className="history-entry" key={h.id}>
                        <div className="history-dot" />
                        <div className="history-entry-body">
                          <div className="history-entry-top"><strong>{FIELD_LABELS[h.field_name] || h.field_name}</strong><time>{formatWhen(h.changed_at)}</time></div>
                          <div className="history-change"><span>{h.old_value ?? '—'}</span><b>→</b><span>{h.new_value ?? '—'}</span></div>
                          {h.reason && <p>{h.reason}</p>}
                          <small>{h.changed_by_email || 'Bulk import/script'}</small>
                        </div>
                      </div>
                    ))}</div>}
                </div>
              )}

              {showImageViewer && p.image_url && createPortal(
                <div
                  className="pd-image-viewer"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Product image viewer"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setShowImageViewer(false);
                  }}
                >
                  <button
                    type="button"
                    className="pd-image-viewer-close"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowImageViewer(false);
                    }}
                    aria-label="Close image viewer"
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                  <div className="pd-image-viewer-content" onClick={(e) => e.stopPropagation()}>
                    <img src={p.image_url} alt={p.description || 'Product'} />
                    <div className="pd-image-viewer-caption">Tap outside or press Esc to close</div>
                  </div>
                </div>,
                document.body
              )}
            </main>
          </div>
        </div>
        {onNext && <button className="modal-nav-btn next" onClick={onNext} title="Next">›</button>}
      </div>
    </div>
  );
}
