import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import ScannerModal from './ScannerModal.jsx';
import { useAuth } from '../lib/useAuth.js';

const CATEGORY_FALLBACK = ['All', 'Beauty', 'Home', 'Kitchen', 'Garments', 'Travel'];

function getImage(item) {
  return item?.image_url || '';
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

function HeartIcon({ filled = false }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.7c0 5.1-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" fill={filled ? "currentColor" : "none"} /></svg>;
}
function CartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2l1.7 9.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7"/><circle cx="10" cy="19" r="1.2"/><circle cx="18" cy="19" r="1.2"/></svg>;
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
  return <div className="showroom-popup-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="showroom-popup" role="dialog" aria-modal="true" aria-label={title}>
      <div className="showroom-popup-header"><div><div className="showroom-popup-eyebrow">{eyebrow || 'G-RECORDS'}</div><h2>{title}</h2></div><button type="button" className="showroom-popup-close" onClick={onClose} aria-label="Close">×</button></div>
      <div className="showroom-popup-body">{children}</div>
    </section>
  </div>;
}

function createQuotationRequestPdf({ orderNumber, customerName, customerEmail, items, comments }) {
  const sanitize = value => String(value ?? '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/×/g, 'x')
    .replace(/₹/g, 'Rs')
    .replace(/[^\x20-\x7E]/g, '');

  const cleanName = item => {
    const candidates = [item?.description, item?.product_name, item?.name, item?.model, item?.article_no, item?.ean ? `Product ${item.ean}` : ''];
    const value = candidates.find(v => {
      const t = sanitize(v).trim();
      return t && !/^untitled product$/i.test(t) && !/^untitled$/i.test(t);
    });
    return value ? sanitize(value).trim() : 'Product';
  };
  const wrap = (value, width) => {
    const text = sanitize(value || '').trim();
    if (!text) return [''];
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= width) line = next;
      else if (line) { lines.push(line); line = word; }
      else { lines.push(word.slice(0, width)); line = word.slice(width); }
    }
    if (line) lines.push(line);
    return lines;
  };
  const fmtDate = value => {
    if (!value) return '-';
    const text = sanitize(value);
    const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : text;
  };
  const fmtNumber = n => Math.max(1, Number(n) || 1).toLocaleString('en-IN');
  const totalQuantity = items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);

  // A4 landscape-independent coordinate system: 595 x 842 points.
  const W = 595, H = 842;
  const margin = 36;
  const usable = W - margin * 2;
  const encoder = new TextEncoder();
  const byteLength = value => encoder.encode(value).length;
  const pdfText = value => sanitize(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const rgb = (r,g,b) => `${r} ${g} ${b}`;
  const ops = [];

  function rect(x, y, w, h, fill) {
    ops.push(`${rgb(...fill)} rg ${x} ${y} ${w} ${h} re f`);
  }
  function line(x1, y1, x2, y2, stroke=[220,226,235], width=0.7) {
    ops.push(`${width} w ${rgb(...stroke)} RG ${x1} ${y1} m ${x2} ${y2} l S`);
  }
  function text(text, x, y, size=10, color=[25,36,55], font='/F1') {
    ops.push(`${rgb(...color)} rg BT ${font} ${size} Tf ${x} ${y} Td (${pdfText(text)}) Tj ET`);
  }
  function bold(textValue, x, y, size=10, color=[18,30,48]) {
    text(textValue, x, y, size, color, '/F2');
  }

  // Header band
  rect(0, H-96, W, 96, [247, 249, 252]);
  rect(0, H-96, 7, 96, [239, 82, 48]);
  text('G-RECORDS', margin, H-40, 16, [239,82,48], '/F2');
  text('SHOWROOM QUOTATION REQUEST', margin, H-60, 11, [89,105,127], '/F2');
  text('REQUEST', W-margin-112, H-35, 8, [112,126,145], '/F2');
  bold(orderNumber, W-margin-112, H-53, 12);
  text('NON-PRICED CUSTOMER REQUEST', W-margin-180, H-75, 8, [239,82,48], '/F2');

  // Customer block
  let y = H - 122;
  text('CUSTOMER DETAILS', margin, y, 8.5, [112,126,145], '/F2');
  y -= 13;
  rect(margin, y-42, usable, 42, [250,251,253]);
  const col2 = margin + usable/2;
  bold('Customer', margin+10, y-14, 8.5, [112,126,145]);
  text(customerName || 'Registered Guest', margin+10, y-29, 10.5);
  bold('Email', col2, y-14, 8.5, [112,126,145]);
  text(customerEmail || '-', col2, y-29, 10.5);
  y -= 59;

  text('REQUESTED PRODUCTS', margin, y, 8.5, [112,126,145], '/F2');
  y -= 14;

  // Table geometry
  const cols = [
    { title: 'S.NO', w: 34, align: 'center' },
    { title: 'PRODUCT DESCRIPTION', w: 274, align: 'left' },
    { title: 'EAN', w: 108, align: 'left' },
    { title: 'QTY', w: 54, align: 'center' },
    { title: 'REQUIRED DATE', w: 89, align: 'center' },
  ];
  const headerH = 26;
  const rowBase = 36;
  const tableX = margin;
  const xPositions = [tableX];
  for (const c of cols) xPositions.push(xPositions[xPositions.length-1] + c.w);

  function tableHeader(topY) {
    rect(tableX, topY-headerH, usable, headerH, [239,82,48]);
    cols.forEach((c, i) => {
      const x0=xPositions[i], center=x0+c.w/2;
      if (c.align==='center') text(c.title, center - c.title.length*2.3, topY-17, 7.5, [255,255,255], '/F2');
      else bold(c.title, x0+7, topY-17, 7.5, [255,255,255]);
      if (i>0) line(x0, topY-headerH, x0, topY, [255,145,122], 0.5);
    });
    return topY-headerH;
  }

  let cursor = tableHeader(y);
  let pageNumber = 1;
  const pageStreams = [];

  // We build each page independently to support long quotations.
  let currentOps = [...ops];
  const footer = () => {
    line(margin, 28, W-margin, 28, [225,229,235], 0.6);
    text('G-RECORDS - Showroom quotation request', margin, 16, 7.5, [117,129,146]);
    text(`Page ${pageNumber}`, W-margin-42, 16, 7.5, [117,129,146]);
  };

  function startContinuationPage() {
    footer();
    pageStreams.push(currentOps.join('\n'));
    pageNumber += 1;
    currentOps = [];
    // repeat compact header
    rect(0, H-56, W, 56, [247,249,252]);
    rect(0, H-56, 7, 56, [239,82,48]);
    text('G-RECORDS', margin, H-24, 12, [239,82,48], '/F2');
    text(`SHOWROOM QUOTATION REQUEST - ${orderNumber}`, margin, H-42, 8.5, [89,105,127], '/F2');
    return H-76;
  }

  let availableY = cursor;
  items.forEach((item, index) => {
    const nameLines = wrap(cleanName(item), 34);
    const rowH = Math.max(rowBase, nameLines.length * 12 + 18);
    if (availableY - rowH < 80) availableY = startContinuationPage();

    if (index % 2 === 1) rect(tableX, availableY-rowH, usable, rowH, [250,251,253]);
    line(tableX, availableY-rowH, tableX+usable, availableY-rowH, [226,230,236], 0.6);
    cols.forEach((c, i) => {
      if (i>0) line(xPositions[i], availableY-rowH, xPositions[i], availableY, [226,230,236], 0.5);
    });

    text(String(index+1), xPositions[0]+14, availableY-rowH/2-3, 9.5, [45,58,79]);
    nameLines.forEach((lineText, li) => text(lineText, xPositions[1]+7, availableY-16-(li*12), 9.2, [25,36,55]));
    text(sanitize(item.ean || '-'), xPositions[2]+7, availableY-rowH/2-3, 8.8, [73,90,115]);
    const qtyText = fmtNumber(item.quantity);
    text(qtyText, xPositions[3] + cols[3].w/2 - qtyText.length*2.4, availableY-rowH/2-3, 9.2, [18,30,48], '/F2');
    const d = fmtDate(item.requiredDate || item.required_date);
    text(d, xPositions[4] + cols[4].w/2 - d.length*2.2, availableY-rowH/2-3, 8.6, [73,90,115]);
    availableY -= rowH;
  });

  // Summary and comments; start a new page if needed.
  if (availableY < 190) availableY = startContinuationPage();
  availableY -= 14;
  rect(margin, availableY-34, usable, 34, [245,247,250]);
  bold('TOTAL PRODUCTS', margin+12, availableY-14, 8.5, [112,126,145]);
  bold(String(items.length), margin+12, availableY-27, 10.5);
  bold('TOTAL QUANTITY', margin+170, availableY-14, 8.5, [112,126,145]);
  bold(fmtNumber(totalQuantity), margin+170, availableY-27, 10.5);
  availableY -= 50;

  text('CUSTOMER COMMENTS', margin, availableY, 8.5, [112,126,145], '/F2');
  const commentLines = wrap(comments || '-', 94);
  const commentH = Math.max(46, commentLines.length*12+20);
  rect(margin, availableY-commentH-8, usable, commentH, [250,251,253]);
  commentLines.slice(0,8).forEach((l, i) => text(l, margin+10, availableY-26-(i*12), 9.2, [45,58,79]));
  availableY -= commentH + 24;

  if (availableY < 90) availableY = startContinuationPage();
  rect(margin, availableY-42, usable, 42, [255,247,243]);
  text('NEXT STEP', margin+10, availableY-15, 8, [239,82,48], '/F2');
  text('Pricing and availability will be confirmed by G-RECORDS Accounts.', margin+10, availableY-30, 9, [73,90,115]);

  footer();
  pageStreams.push(currentOps.join('\n'));

  // Build PDF objects: catalog, pages, fonts, each page + content.
  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const pageNums = pageStreams.map((_,i)=>5+i*2);
  objects.push(`<< /Type /Pages /Kids [${pageNums.map(n=>`${n} 0 R`).join(' ')}] /Count ${pageStreams.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  pageStreams.forEach((stream, i) => {
    const pageNo = 5+i*2, contentNo = pageNo+1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNo} 0 R >>`);
    objects.push(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });

  let pdf='%PDF-1.4\n';
  const offsets=[0];
  objects.forEach((obj,i)=>{ offsets[i+1]=byteLength(pdf); pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`; });
  const xref=byteLength(pdf);
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++) pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const blob=new Blob([encoder.encode(pdf)],{type:'application/pdf'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`G-Records-Quotation-Request-${sanitize(orderNumber)}.pdf`;
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},1200);
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
    name: item.product_name || '',
  }));
  if (!items.length) return;

  // Prefer the current showroom master data when an old order snapshot contains
  // a placeholder such as "Untitled Product". This keeps historical PDFs
  // readable without changing the saved order itself.
  const showroomIds = items.map(item => item.showroom_item_id).filter(Boolean);
  if (showroomIds.length) {
    const { data: showroomRows } = await supabase
      .from('showroom_items')
      .select('id,name,description,model,article_no,ean,category,image_url')
      .in('id', showroomIds);
    const byId = new Map((showroomRows || []).map(row => [String(row.id), row]));
    items = items.map(item => {
      const current = byId.get(String(item.showroom_item_id));
      return current ? { ...current, ...item, description: current.description || item.description } : item;
    });
  }

  createQuotationRequestPdf({
    orderNumber: order.order_number,
    customerName: order.customer_name || 'Registered Guest',
    customerEmail: order.customer_email || '',
    items,
    comments: order.comments || '',
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
        .select('id,order_id,showroom_item_id,product_name,ean,quantity,required_date,availability,quoted_unit_price,account_note,quoted_at')
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
                <button type="button" className="showroom-history-download" onClick={() => downloadOrderQuotation(order)} title="Download quotation request PDF" aria-label={`Download ${order.order_number} PDF`}>↓ PDF</button>
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
                          {item.quoted_unit_price != null && <span><b>Quoted</b> ₹{Number(item.quoted_unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                        </div>
                        {item.account_note && <div className="showroom-history-note">{item.account_note}</div>}
                      </div>
                    ))}
                  </div>
                  {order.comments && <div className="showroom-history-comment"><b>Comments</b><span>{order.comments}</span></div>}
                  <div className="showroom-history-footer">
                    <span>Last updated {new Date(order.updated_at || order.submitted_at).toLocaleString('en-IN')}</span>
                    <span>{formatOrderStatus(order.status)}</span>
                    <button type="button" className="showroom-history-download-link" onClick={() => downloadOrderQuotation(order)}>Download PDF</button>
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

function SelectionPopup({ mode, products, onClose, onOpen, isFavourite, inCart, onToggleFavourite, onToggleCart, cartQuantities, setCartQuantities, customerProfile, session }) {
  const isCart = mode === 'cart';
  const [comments, setComments] = useState(() => { try { return localStorage.getItem('g-records-showroom-order-comments') || ''; } catch { return ''; } });
  const [requiredDates, setRequiredDates] = useState(() => { try { return JSON.parse(localStorage.getItem('g-records-showroom-required-dates') || '{}'); } catch { return {}; } });
  const [preview, setPreview] = useState(() => { try { return localStorage.getItem('g-records-showroom-order-preview') === '1'; } catch { return false; } });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const selectedProducts = products.filter(item => isCart ? inCart(item) : isFavourite(item));
  const updateQty = (id, value) => setCartQuantities(current => ({ ...current, [String(id)]: Math.max(1, Math.floor(Number(value) || 1)) }));
  const updateRequiredDate = (id, value) => setRequiredDates(current => { const next = { ...current, [String(id)]: value }; localStorage.setItem('g-records-showroom-required-dates', JSON.stringify(next)); return next; });
  useEffect(() => { try { localStorage.setItem('g-records-showroom-order-comments', comments); } catch {} }, [comments]);
  useEffect(() => { try { localStorage.setItem('g-records-showroom-order-preview', preview ? '1' : '0'); } catch {} }, [preview]);

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
    createQuotationRequestPdf({
      orderNumber,
      customerName: customerProfile?.full_name || session.user.email,
      customerEmail,
      items,
      comments,
    });

    const { error: emailError } = await supabase.functions.invoke('send-showroom-quotation', {
      body: { orderId: order.id },
    });
    if (emailError) {
      console.warn('Order saved, but email notification failed:', emailError.message);
    }

    setSubmitted(orderNumber);
    setSubmitting(false);
    setCart([]);
    try {
      localStorage.removeItem('g-records-showroom-cart');
      localStorage.removeItem('g-records-showroom-order-comments');
      localStorage.removeItem('g-records-showroom-order-preview');
      localStorage.removeItem('g-records-showroom-required-dates');
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
    <div className="showroom-popup-empty"><div className="showroom-popup-empty-icon">✓</div><h3>Quotation request sent</h3><p>Request <strong>{submitted}</strong> has been sent to your registered email and G-RECORDS Accounts. Your PDF has also been downloaded.</p><div className="showroom-popup-footer"><button type="button" className="showroom-primary-btn" onClick={onClose}>Done</button></div></div>
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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [collectionMode, setCollectionMode] = useState('all');
  const [favourites, setFavourites] = useState(() => { try { return JSON.parse(localStorage.getItem('g-records-showroom-favourites') || '[]'); } catch { return []; } });
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('g-records-showroom-cart') || '[]'); } catch { return []; } });
  const [cartQuantities, setCartQuantities] = useState(() => { try { return JSON.parse(localStorage.getItem('g-records-showroom-cart-quantities') || '{}'); } catch { return {}; } });
  const [popup, setPopup] = useState(() => {
    try { return localStorage.getItem('g-records-showroom-popup') || null; } catch { return null; }
  });

  useEffect(() => {
    try {
      if (popup) localStorage.setItem('g-records-showroom-popup', popup);
      else localStorage.removeItem('g-records-showroom-popup');
    } catch {}
  }, [popup]);

  useEffect(() => { localStorage.setItem('g-records-showroom-favourites', JSON.stringify(favourites)); }, [favourites]);
  useEffect(() => { localStorage.setItem('g-records-showroom-cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('g-records-showroom-cart-quantities', JSON.stringify(cartQuantities)); }, [cartQuantities]);

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
    const { data, error: err } = await supabase
      .from('showroom_items')
      .select('id,source_type,ean,article_no,name,brand,model,category,description,image_url,features,dimensions,mrp,sku_l,sku_w,sku_h,sku_dim_unit,sku_nw,sku_gw,sku_wt_unit,featured,visible')
      .eq('visible', true)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });
    if (err) setError(err.message || 'Unable to load showroom products');
    else setItems(data || []);
    setLoading(false);
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
    const params = new URLSearchParams(window.location.search);
    const code = params.get('product') || params.get('ean') || params.get('qr');
    if (!code || !items.length) return;
    const normalized = String(code).trim().toLowerCase().replace(/\s+/g, '');
    const found = items.find(item => [item.ean, item.article_no, item.model, item.id].filter(Boolean).some(v => String(v).trim().toLowerCase().replace(/\s+/g, '') === normalized));
    if (found) setSelected(found);
  }, [items]);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== 'Escape') return;
      if (scannerOpen) return;
      if (selected) {
        event.preventDefault();
        setSelected(null);
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
      if (category !== 'All' && String(item.category || '') !== category) return false;
      if (!q) return true;
      return [item.name, item.brand, item.model, item.category, item.ean, item.article_no].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    });
  }, [items, search, category]);

  const featured = useMemo(() => items.filter(x => x.featured).slice(0, 4), [items]);

  function openItem(item) {
    setSelected(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openScanner() { setScannerOpen(true); }
  function handleScan(item) { setScannerOpen(false); openItem(item); }

  if (selected) {
    return (
      <div className="showroom-app showroom-app-detail">
        <ShowroomHeader search={search} setSearch={value => { setSearch(value); setCollectionMode('all'); }} onScan={openScanner} onSignOut={signOut} favouriteCount={favouriteCount} cartCount={cartCount} onFavourites={() => setPopup('favourites')} onCart={() => setPopup('cart')} onOrders={() => setOrderHistoryOpen(true)} orderCount={recentOrderCount} />
        <ProductDetail item={selected} onBack={() => setSelected(null)} onScanAnother={openScanner} isFavourite={isFavourite(selected)} inCart={inCart(selected)} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} />
        {scannerOpen && <ScannerModal products={items} onScan={handleScan} onClose={() => setScannerOpen(false)} />}
        {orderHistoryOpen && <OrderHistoryPopup onClose={() => setOrderHistoryOpen(false)} session={session} />}
      {popup && <SelectionPopup mode={popup} products={items} onClose={() => setPopup(null)} onOpen={openItem} isFavourite={isFavourite} inCart={inCart} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} cartQuantities={cartQuantities} setCartQuantities={setCartQuantities} customerProfile={profile} session={session} />}
      </div>
    );
  }

  return (
    <div className="showroom-app">
      <ShowroomHeader search={search} setSearch={value => { setSearch(value); setCollectionMode('all'); }} onScan={openScanner} onSignOut={signOut} favouriteCount={favouriteCount} cartCount={cartCount} onFavourites={() => setPopup('favourites')} onCart={() => setPopup('cart')} onOrders={() => setOrderHistoryOpen(true)} orderCount={recentOrderCount} />
      <main className="showroom-main">
        <section className="showroom-hero">
          <div>
            <span className="showroom-hero-eyebrow">WELCOME TO THE SHOWROOM</span>
            <h1>Explore our products.</h1>
            <p>Browse the collection, discover product highlights, or scan the QR code on a display to open the product instantly.</p>
            <div className="showroom-hero-actions">
              <button type="button" className="showroom-primary-btn" onClick={openScanner}><QrIcon /> Scan product QR</button>
              <button type="button" className="showroom-outline-btn" onClick={() => window.scrollTo({ top: 520, behavior: 'smooth' })}>Browse collection</button>
            </div>
          </div>
          <div className="showroom-hero-orbit" aria-hidden="true"><div className="showroom-orbit-ring ring-1"/><div className="showroom-orbit-ring ring-2"/><div className="showroom-orbit-core">G</div></div>
        </section>

        {featured.length > 0 && (
          <section className="showroom-section-block">
            <div className="showroom-block-heading"><div><span>HANDPICKED</span><h2>Featured products</h2></div><button type="button" onClick={() => setSearch('')}>View all <ArrowIcon /></button></div>
            <div className="showroom-featured-grid">{featured.map(item => <ProductCard key={item.id} item={item} onOpen={openItem} isFavourite={isFavourite(item)} inCart={inCart(item)} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} />)}</div>
          </section>
        )}

        <section className="showroom-section-block" id="showroom-collection">
          <div className="showroom-block-heading"><div><span>{collectionMode === 'favourites' ? 'YOUR SELECTION' : collectionMode === 'cart' ? 'YOUR CART' : 'COLLECTION'}</span><h2>{collectionMode === 'favourites' ? 'Favourite products' : collectionMode === 'cart' ? 'Cart' : 'Browse products'}</h2></div><div className="showroom-result-count">{loading ? 'Loading…' : `${filtered.length} products`}</div></div>
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
      {scannerOpen && <ScannerModal products={items} onScan={handleScan} onClose={() => setScannerOpen(false)} />}
      {orderHistoryOpen && <OrderHistoryPopup onClose={() => setOrderHistoryOpen(false)} session={session} />}
      {popup && <SelectionPopup mode={popup} products={items} onClose={() => setPopup(null)} onOpen={openItem} isFavourite={isFavourite} inCart={inCart} onToggleFavourite={toggleFavourite} onToggleCart={toggleCart} cartQuantities={cartQuantities} setCartQuantities={setCartQuantities} customerProfile={profile} session={session} />}
    </div>
  );
}
