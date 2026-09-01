import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import ScannerModal from './ScannerModal.jsx';
import { useAuth } from '../lib/useAuth.js';

const CATEGORY_FALLBACK = ['All', 'Beauty', 'Home', 'Kitchen', 'Garments', 'Travel'];

function getImage(item) {
  return item?.image_url || '';
}

function displayName(item) {
  return item?.name || item?.model || item?.article_no || 'Untitled Product';
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

function ShowroomHeader({ search, setSearch, onScan, onSignOut }) {
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
        <button className="showroom-guest-btn" type="button" onClick={onSignOut}>Guest</button>
      </div>
    </header>
  );
}

function ProductCard({ item, onOpen }) {
  return (
    <button type="button" className="showroom-product-card" onClick={() => onOpen(item)}>
      <div className="showroom-product-image-wrap">
        {getImage(item) ? <img src={getImage(item)} alt="" loading="lazy" /> : <div className="showroom-image-fallback">{String(item?.category || 'PRODUCT').slice(0, 1).toUpperCase()}</div>}
        {item.featured && <span className="showroom-featured-pill">Featured</span>}
      </div>
      <div className="showroom-product-card-body">
        <div className="showroom-product-category">{item.category || item.source_type}</div>
        <h3>{displayName(item)}</h3>
        <p>{[item.model, item.article_no ? `SKU: ${item.article_no}` : '', item.ean ? `EAN: ${item.ean}` : ''].filter(Boolean).join(' · ') || 'Product details'}</p>
        <span className="showroom-view-link">View details <ArrowIcon /></span>
      </div>
    </button>
  );
}

function getGallery(item) {
  const candidates = [item?.image_url, ...(Array.isArray(item?.images) ? item.images : []), ...(Array.isArray(item?.image_urls) ? item.image_urls : [])];
  return [...new Set(candidates.filter(Boolean).map(String))];
}

function ProductDetail({ item, onBack, onScanAnother }) {
  const gallery = getGallery(item);
  const [imageOpen, setImageOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const highlights = Array.isArray(item?.features) ? item.features : [];

  useEffect(() => {
    if (!imageOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setImageOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
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

          <section className="showroom-section showroom-sku-section">
            <div className="showroom-section-title">SKU details</div>
            <div className="showroom-sku-grid">
              {[
                ['Article No.', item.article_no],
                ['EAN', item.ean],
                ['Model', item.model],
                ['Category', item.category],
              ].filter(([, value]) => value).map(([label, value]) => (
                <div className="showroom-sku-item" key={label}><span>{label}</span><strong>{value}</strong></div>
              ))}
            </div>
          </section>

          {item.dimensions && (
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

          <div className="showroom-detail-actions">
            <button type="button" className="showroom-secondary-btn" onClick={onScanAnother}><QrIcon /> Scan another product</button>
            <button type="button" className="showroom-primary-btn" onClick={onBack}>Back to showroom <ArrowIcon /></button>
          </div>
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
  const { signOut } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('showroom_items')
      .select('id,source_type,ean,article_no,name,brand,model,category,description,image_url,features,dimensions,featured,visible')
      .eq('visible', true)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });
    if (err) setError(err.message || 'Unable to load showroom products');
    else setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('product') || params.get('ean') || params.get('qr');
    if (!code || !items.length) return;
    const normalized = String(code).trim().toLowerCase().replace(/\s+/g, '');
    const found = items.find(item => [item.ean, item.article_no, item.model, item.id].filter(Boolean).some(v => String(v).trim().toLowerCase().replace(/\s+/g, '') === normalized));
    if (found) setSelected(found);
  }, [items]);

  const categories = useMemo(() => {
    const values = [...new Set(items.map(x => String(x.category || '').trim()).filter(Boolean))];
    return ['All', ...values].length > 1 ? ['All', ...values] : CATEGORY_FALLBACK;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(item => {
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
        <ShowroomHeader search={search} setSearch={setSearch} onScan={openScanner} onSignOut={signOut} />
        <ProductDetail item={selected} onBack={() => setSelected(null)} onScanAnother={openScanner} />
        {scannerOpen && <ScannerModal products={items} onScan={handleScan} onClose={() => setScannerOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="showroom-app">
      <ShowroomHeader search={search} setSearch={setSearch} onScan={openScanner} onSignOut={signOut} />
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
            <div className="showroom-featured-grid">{featured.map(item => <ProductCard key={item.id} item={item} onOpen={openItem} />)}</div>
          </section>
        )}

        <section className="showroom-section-block" id="showroom-collection">
          <div className="showroom-block-heading"><div><span>COLLECTION</span><h2>Browse products</h2></div><div className="showroom-result-count">{loading ? 'Loading…' : `${filtered.length} products`}</div></div>
          <div className="showroom-category-row">
            {categories.map(cat => <button key={cat} type="button" className={category === cat ? 'active' : ''} onClick={() => setCategory(cat)}>{cat}</button>)}
          </div>
          {error && <div className="showroom-error">{error}<button type="button" onClick={load}>Retry</button></div>}
          {loading ? <div className="showroom-empty-state"><div className="showroom-loader"/><p>Loading showroom collection…</p></div>
            : filtered.length ? <div className="showroom-product-grid">{filtered.map(item => <ProductCard key={item.id} item={item} onOpen={openItem} />)}</div>
            : <div className="showroom-empty-state"><div className="showroom-empty-icon">⌕</div><h3>No products found</h3><p>Try another search or category.</p></div>}
        </section>
      </main>
      <footer className="showroom-footer"><div>G-Records · Product Showroom</div><div>Guest access · Public product information only</div></footer>
      {scannerOpen && <ScannerModal products={items} onScan={handleScan} onClose={() => setScannerOpen(false)} />}
    </div>
  );
}
