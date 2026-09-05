import React, { useMemo, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { fmtINR, discountPct, formatMonthLabel, normalizeMonthValue, extractYear, yearOptions, uniqueSorted, monthOptions } from '../lib/helpers.js';
import ProductModal from './ProductModal.jsx';
import { ResetIcon, DownloadIcon, ScanIcon } from './Icons.jsx';
import ScannerModal from './ScannerModal.jsx';
import { useHideOnScroll } from '../lib/useHideOnScroll.js';
import CatalogueExport from './CatalogueExport.jsx';

export default function Catalog({ products, initialFilters, onEdit, onDelete, isAuthed, lookupCode, active = true }) {
  const savedState = (() => {
    try { return JSON.parse(sessionStorage.getItem('article-ledger:catalog-state') || '{}'); } catch { return {}; }
  })();
  const [q, setQ] = useState(savedState.q || '');
  const [searchFocused, setSearchFocused] = useState(false);
  const [cat, setCat] = useState(savedState.cat || '');
  const [brand, setBrand] = useState(savedState.brand || '');
  const [month, setMonth] = useState(savedState.month || '');
  const [year, setYear] = useState(savedState.year || '');
  const [selected, setSelected] = useState(null);
  const [showCatalogueExport, setShowCatalogueExport] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [autoOpenPending, setAutoOpenPending] = useState(false);
  const controlsHidden = useHideOnScroll();

  useEffect(() => {
    if (initialFilters) {
      setCat(initialFilters.category || '');
      setBrand(initialFilters.brand || '');
      setMonth(initialFilters.month || '');
      setYear(initialFilters.year || '');
      setQ(initialFilters.search || '');
      setAutoOpenPending(!!initialFilters.autoOpen);
    }
  }, [initialFilters]);

  useEffect(() => {
    try {
      // Keep filter state across navigation, but never persist an open
      // product modal. Persisting selectedId could reopen the last article
      // after a reload and leave the modal over other screens.
      sessionStorage.setItem('article-ledger:catalog-state', JSON.stringify({
        q, cat, brand, month, year,
      }));
    } catch {}
  }, [q, cat, brand, month, year]);

  useEffect(() => {
    if (!active) {
      setSelected(null);
      setShowCatalogueExport(false);
      setShowScanner(false);
      setAutoOpenPending(false);
    }
  }, [active]);


  // Each filter's dropdown is calculated from the other active filters.
  // This keeps the choices mutually consistent instead of showing the full
  // database when a year/month/brand/category has already been selected.
  const rowsForFilter = (exclude) => products.filter(p => {
    if (exclude !== 'category' && cat && p.category !== cat) return false;
    if (exclude !== 'brand' && brand && p.brand !== brand) return false;
    if (exclude !== 'month' && month && normalizeMonthValue(p.month) !== month) return false;
    if (exclude !== 'year' && year && extractYear(p.month) !== year) return false;
    return true;
  });

  const categories = uniqueSorted(rowsForFilter('category'), 'category');
  const brands = uniqueSorted(rowsForFilter('brand'), 'brand');
  const months = monthOptions(rowsForFilter('month'));
  const years = yearOptions(rowsForFilter('year'));

  // If a newly selected filter makes another existing selection impossible,
  // clear only that now-invalid selection. The dropdowns then recalculate.
  useEffect(() => {
    if (cat && !categories.includes(cat)) setCat('');
  }, [cat, categories.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (brand && !brands.includes(brand)) setBrand('');
  }, [brand, brands.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (month && !months.includes(month)) setMonth('');
  }, [month, months.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (year && !years.includes(year)) setYear('');
  }, [year, years.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchSuggestions = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const seen = new Set();
    const out = [];
    for (const p of products) {
      const candidates = [
        ['EAN', p.ean], ['Article No.', p.article_no], ['Model', p.model],
        ['Description', p.description], ['Brand', p.brand], ['Category', p.category], ['HSN', p.hsn]
      ];
      for (const [type, value] of candidates) {
        if (!value) continue;
        const text = String(value);
        const key = type + '|' + text.toLowerCase();
        if (!seen.has(key) && text.toLowerCase().includes(query)) { seen.add(key); out.push({ type, value: text }); }
        if (out.length >= 8) return out;
      }
    }
    return out;
  }, [products, q]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const monthNumbers = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

    const getDateKey = (p) => {
      const raw = normalizeMonthValue(p.month) || '';
      const match = raw.match(/^([A-Z]{3})-(\d{2})$/);
      if (match) {
        return (2000 + Number(match[2])) * 100 + (monthNumbers[match[1]] || 0);
      }
      const fullYear = extractYear(p.month);
      return fullYear ? Number(fullYear) * 100 : 0;
    };

    return products
      .filter(p => {
        if (cat && p.category !== cat) return false;
        if (brand && p.brand !== brand) return false;
        if (month && normalizeMonthValue(p.month) !== month) return false;
        if (year && extractYear(p.month) !== year) return false;
        if (query) {
          const hay = [p.ean, p.brand, p.category, p.description, p.model, p.article_no, p.hsn, p.marketed_by, p.month, p.id]
            .filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Newest manufacturing/import month first. For products in the same
        // month, use created_at so newly added articles appear first.
        const dateDiff = getDateKey(b) - getDateKey(a);
        if (dateDiff !== 0) return dateDiff;

        const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (createdB !== createdA) return createdB - createdA;

        // Stable final tie-breaker so the order doesn't appear random.
        return String(a.description || a.model || a.ean || '').localeCompare(
          String(b.description || b.model || b.ean || '')
        );
      });
  }, [products, q, cat, brand, month, year]);

  useEffect(() => {
    if (autoOpenPending && filtered.length >= 1) {
      setSelected(filtered[0]);
      setAutoOpenPending(false);
    }
  }, [autoOpenPending, filtered]);

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setSelected(null);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const list = filtered;
        const idx = list.findIndex(p => p.id === selected.id);
        if (idx === -1) return;
        const nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
        if (nextIdx >= 0 && nextIdx < list.length) {
          e.preventDefault();
          setSelected(list[nextIdx]);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, filtered]);

  function resetFilters() {
    setQ(''); setCat(''); setBrand(''); setMonth(''); setYear('');
  }

  function downloadXlsx() {
    const headers = ['ID', 'Month', 'Category', 'Brand', 'Model', 'Description', 'EAN', 'MRP', 'SP', 'Discount %', 'HSN', 'Article No', 'Marketed By',
      'Master Qty', 'Inner Qty',
      'SKU L', 'SKU W', 'SKU H', 'SKU Dim Unit', 'SKU Net Wt', 'SKU Gross Wt', 'SKU Weight Unit',
      'Master L', 'Master W', 'Master H', 'Master Dim Unit', 'Master Net Wt', 'Master Gross Wt', 'Master Weight Unit',
      'Inner L', 'Inner W', 'Inner H', 'Inner Dim Unit', 'Inner Net Wt', 'Inner Gross Wt', 'Inner Weight Unit'];
    const aoa = [headers];
    filtered.forEach(p => {
      const off = discountPct(p.mrp, p.sp);
      aoa.push([
        p.id, formatMonthLabel(p.month), p.category, p.brand, p.model, p.description,
        p.ean, p.mrp ?? '', p.sp ?? '', off ?? '', p.hsn, p.article_no, p.marketed_by,
        p.master_qty ?? '', p.inner_qty ?? '',
        p.sku_l ?? '', p.sku_w ?? '', p.sku_h ?? '', p.sku_dim_unit ?? '', p.sku_nw ?? '', p.sku_gw ?? '', p.sku_wt_unit ?? '',
        p.master_l ?? '', p.master_w ?? '', p.master_h ?? '', p.master_dim_unit ?? '', p.master_nw ?? '', p.master_gw ?? '', p.master_wt_unit ?? '',
        p.inner_l ?? '', p.inner_w ?? '', p.inner_h ?? '', p.inner_dim_unit ?? '', p.inner_nw ?? '', p.inner_gw ?? '', p.inner_wt_unit ?? '',
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map(() => ({ wch: 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Articles');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `article-ledger-filtered-${stamp}.xlsx`);
  }

  return (
    <>
      <div className={`controls${controlsHidden ? ' controls-hidden' : ''}`}>
        <div className="controls-row">
          <div className="search-box search-box-enhanced">
            <span className="search-glyph">⌕</span>
            <input aria-label="Search articles" placeholder="Search EAN, Article No., model, brand, category, HSN…" value={q} onFocus={() => setSearchFocused(true)} onBlur={() => setTimeout(() => setSearchFocused(false), 120)} onChange={(e) => setQ(e.target.value)} />
            {q && <button type="button" className="search-clear" onMouseDown={(e)=>e.preventDefault()} onClick={() => setQ('')} aria-label="Clear search">×</button>}
            <button type="button" className="search-scan-btn" onMouseDown={(e)=>e.preventDefault()} onClick={() => setShowScanner(true)} aria-label="Scan QR or barcode" title="Scan QR / Barcode"><ScanIcon /></button>
            {searchFocused && q && searchSuggestions.length > 0 && (
              <div className="search-suggestions">
                {searchSuggestions.map((s, i) => <button key={i} type="button" onMouseDown={(e)=>e.preventDefault()} onClick={() => setQ(s.value)}><span>{s.type}</span><strong>{s.value}</strong></button>)}
              </div>
            )}
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">All brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">All months</option>
            {months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="icon-btn-group">
            <button className="btn btn-rust icon-btn" onClick={resetFilters} title="Reset filters" aria-label="Reset filters"><ResetIcon /></button>
            <button className="btn btn-teal icon-btn" onClick={downloadXlsx} title="Download filtered (.xlsx)" aria-label="Download filtered (.xlsx)"><DownloadIcon /></button>
            <button className="btn btn-teal" onClick={() => setShowCatalogueExport(true)} title="Create catalogue">Catalogue</button>
          </div>
        </div>
        <div className="result-count"><b>{filtered.length}</b> articles found {q && <span>for <strong>“{q}”</strong></span>}</div>
      </div>

      <main>
        {filtered.length === 0 ? (
          <div className="empty">
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, color: 'var(--ink)', fontWeight: 600, marginBottom: 8 }}>
              No matching articles
            </div>
            Try a different EAN, brand, or category — or clear filters.
          </div>
        ) : (
          <div className="grid">
            {filtered.map(p => {
              const off = discountPct(p.mrp, p.sp);
              return (
                <article key={p.id} className="card" onClick={() => setSelected(p)}>
                  {p.custom && <div className="custom-flag">Added</div>}
                  <div className="card-img">
                    {p.image_url ? <img src={p.image_url} alt={p.description} loading="lazy" /> : <div className="no-img">NO IMAGE<br />ON FILE</div>}
                  </div>
                  <div className="card-body">
                    <span className="cat-tag">{p.category}</span>
                    <h3 className="card-title">{p.description || p.model || 'Unnamed article'}</h3>
                    <div className="card-brand">{p.brand}{p.model ? ` · ${p.model}` : ''}</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: 'var(--ink-soft)' }}>{p.ean || 'EAN N/A'}</div>
                    <div className="price-row">
                      {p.sp != null ? (
                        <>
                          <span className="sp">{fmtINR(p.sp)}</span>
                          {p.mrp ? <span className="mrp">{fmtINR(p.mrp)}</span> : null}
                          {off ? <span className="off-badge">{off}% OFF</span> : null}
                        </>
                      ) : (
                        p.mrp != null && <span className="sp">{fmtINR(p.mrp)}</span>
                      )}
                    </div>
                    <div className="meta-line"><span>HSN {p.hsn || '—'}</span><span>{formatMonthLabel(p.month)}</span></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {active && selected && (
        <ProductModal
          product={selected}
          isAuthed={isAuthed}
          onClose={() => setSelected(null)}
          onEdit={() => { const p = selected; setSelected(null); onEdit(p); }}
          onDelete={() => { const p = selected; setSelected(null); onDelete(p); }}
          onPrev={(() => {
            const idx = filtered.findIndex(p => p.id === selected.id);
            return idx > 0 ? () => setSelected(filtered[idx - 1]) : null;
          })()}
          onNext={(() => {
            const idx = filtered.findIndex(p => p.id === selected.id);
            return idx !== -1 && idx < filtered.length - 1 ? () => setSelected(filtered[idx + 1]) : null;
          })()}
        />
      )}

      {active && showCatalogueExport && <CatalogueExport type="general" rows={filtered} onClose={() => setShowCatalogueExport(false)} />}
      {active && showScanner && <ScannerModal products={products} lookupCode={lookupCode} onClose={() => setShowScanner(false)} onScan={(product) => { setShowScanner(false); setQ(String(product.ean || product.article_no || product.model || '')); setSelected(product); }} />}
    </>
  );
}
