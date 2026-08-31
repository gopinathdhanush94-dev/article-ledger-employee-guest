import React, { useMemo, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { fmtINR, uniqueSorted, extractYear } from '../lib/helpers.js';
import { ResetIcon, DownloadIcon } from './Icons.jsx';
import { useHideOnScroll } from '../lib/useHideOnScroll.js';
import CatalogueExport from './CatalogueExport.jsx';

const SHEET_ORDER = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUNE'];

function groupGarments(rows) {
  const map = new Map();
  for (const r of rows) {
    // grouping includes the sheet/month so each monthly listing stays its own card
    const key = [r.source_file, r.sheet, r.excel_name, r.color, r.customer_model].join('|');
    if (!map.has(key)) {
      map.set(key, {
        key,
        excel_name: r.excel_name,
        model_name: r.model_name,
        model1: r.model1,
        brand: r.brand,
        description: r.description,
        color: r.color,
        customer_model: r.customer_model,
        origin: r.origin,
        moi: r.moi,
        mfd: r.mfd,
        sheet: r.sheet,
        master_ean: r.master_ean,
        master_article: r.master_article,
        image_url: r.image_url,
        mrp: r.mrp,
        rrp: r.rrp,
        source_file: r.source_file,
        year: extractYear(r.source_file) || extractYear(r.moi) || extractYear(r.mfd),
        sizes: [],
      });
    }
    const g = map.get(key);
    if (!g.image_url && r.image_url) g.image_url = r.image_url;
    g.sizes.push(r);
  }
  return [...map.values()];
}

export default function Garments({ garments, initialFilters, onEdit, onDelete }) {
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('');
  const [modelName, setModelName] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCatalogueExport, setShowCatalogueExport] = useState(false);
  const controlsHidden = useHideOnScroll();

  useEffect(() => {
    if (initialFilters) {
      setBrand(initialFilters.brand || '');
      setModelName(initialFilters.modelName || '');
      setMonth(initialFilters.month || '');
      setYear(initialFilters.year || '');
      setQ(initialFilters.search || '');
    }
  }, [initialFilters]);

  const grouped = useMemo(() => groupGarments(garments), [garments]);

  // Every garment filter is dependent on the other active filters.
  // Year is derived from the garment source/import year (for example
  // source_file = 2026_LIVESMEART), while Month comes from the sheet.
  const rowsForFilter = (exclude) => grouped.filter(g => {
    if (exclude !== 'brand' && brand && g.brand !== brand) return false;
    if (exclude !== 'modelName' && modelName && g.model_name !== modelName) return false;
    if (exclude !== 'month' && month && String(g.sheet || '').toUpperCase() !== month) return false;
    if (exclude !== 'year' && year && g.year !== year) return false;
    return true;
  });

  const brands = uniqueSorted(rowsForFilter('brand'), 'brand');
  const modelNames = uniqueSorted(rowsForFilter('modelName'), 'model_name');
  const months = [...new Set(rowsForFilter('month').map(g => String(g.sheet || '').toUpperCase()).filter(Boolean))]
    .sort((a, b) => {
      const ai = SHEET_ORDER.indexOf(a), bi = SHEET_ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
  const years = [...new Set(rowsForFilter('year').map(g => g.year).filter(Boolean))]
    .sort((a, b) => String(b).localeCompare(String(a)));

  // If another filter makes an existing selection unavailable, clear only
  // that invalid selection. The remaining dropdowns then recalculate.
  useEffect(() => {
    if (brand && !brands.includes(brand)) setBrand('');
  }, [brand, brands.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (modelName && !modelNames.includes(modelName)) setModelName('');
  }, [modelName, modelNames.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (month && !months.includes(month)) setMonth('');
  }, [month, months.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (year && !years.includes(year)) setYear('');
  }, [year, years.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return grouped.filter(g => {
      if (brand && g.brand !== brand) return false;
      if (modelName && g.model_name !== modelName) return false;
      if (month && String(g.sheet || '').toUpperCase() !== month) return false;
      if (year && g.year !== year) return false;
      if (query) {
        const hay = [
          g.excel_name, g.model_name, g.brand, g.color, g.customer_model, g.model1,
          ...g.sizes.map(s => s.ean), ...g.sizes.map(s => s.article),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [grouped, q, brand, modelName, month, year]);

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setSelected(null);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const idx = filtered.findIndex(g => g.key === selected.key);
        if (idx === -1) return;
        const nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
        if (nextIdx >= 0 && nextIdx < filtered.length) {
          e.preventDefault();
          setSelected(filtered[nextIdx]);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, filtered]);

  function resetFilters() { setQ(''); setBrand(''); setModelName(''); setMonth(''); setYear(''); }

  function downloadXlsx() {
    const headers = ['Source', 'Month', 'Style Name', 'Garment Type', 'Brand', 'Color', 'Customer Model', 'Internal Model',
      'Description', 'Origin', 'MOI', 'MFD', 'Master EAN', 'Master Article',
      'Size', 'Set Qty', 'EAN', 'Article', 'MRP', 'RRP'];
    const aoa = [headers];
    filtered.forEach(g => {
      g.sizes.forEach(s => {
        aoa.push([
          g.source_file, g.sheet, g.excel_name, g.model_name, g.brand, g.color, g.customer_model, g.model1,
          g.description, g.origin, g.moi, g.mfd, g.master_ean, g.master_article,
          s.size, s.ratio ?? '', s.ean, s.article, s.mrp ?? '', s.rrp ?? '',
        ]);
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map(() => ({ wch: 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Garments');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `garments-filtered-${stamp}.xlsx`);
  }

  return (
    <>
      <div className={`controls${controlsHidden ? ' controls-hidden' : ''}`}>
        <div className="controls-row">
          <div className="search-box">
            <input
              placeholder="Search by style, brand, color, EAN or article…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">All brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={modelName} onChange={(e) => setModelName(e.target.value)}>
            <option value="">All garment types</option>
            {modelNames.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">All months</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
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
        <div className="result-count">
          <b>{filtered.length}</b> garment styles found <span style={{ opacity: 0.6 }}>({garments.length} total size/color SKUs)</span>
        </div>
      </div>

      <main>
        {filtered.length === 0 ? (
          <div className="empty">
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, color: 'var(--ink)', fontWeight: 600, marginBottom: 8 }}>
              No matching garments
            </div>
            Try a different brand, color, month, or search term.
          </div>
        ) : (
          <div className="grid">
            {filtered.map(g => {
              const sizeList = g.sizes.map(s => s.size).filter(Boolean).join(', ');
              return (
                <article key={g.key} className="card" onClick={() => setSelected(g)}>
                  {g.sizes.some(s => s.custom) && <div className="custom-flag">Added</div>}
                  <div className="card-img no-blend">
                    {g.image_url ? <img src={g.image_url} alt={g.excel_name} loading="lazy" /> : <div className="no-img">NO IMAGE<br />ON FILE</div>}
                  </div>
                  <div className="card-body">
                    <span className="cat-tag">{g.model_name || 'Garment'}</span>
                    <h3 className="card-title">{g.excel_name || g.customer_model || 'Unnamed style'}</h3>
                    <div className="card-brand">{g.brand}{g.color ? ` · ${g.color}` : ''}</div>
                    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10.5, color: 'var(--ink-soft)' }}>
                      {sizeList || 'No sizes listed'}
                    </div>
                    <div className="price-row">
                      <span className="sp">{fmtINR(g.rrp)}</span>
                      {g.mrp ? <span className="mrp">{fmtINR(g.mrp)}</span> : null}
                    </div>
                    <div className="meta-line"><span>{g.sizes.length} size{g.sizes.length === 1 ? '' : 's'}</span><span>{g.sheet || g.source_file}</span></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {selected && (
        <GarmentModal
          garment={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { const g = selected; setSelected(null); onEdit(g); }}
          onDelete={() => { const g = selected; setSelected(null); onDelete(g); }}
          onPrev={(() => {
            const idx = filtered.findIndex(x => x.key === selected.key);
            return idx > 0 ? () => setSelected(filtered[idx - 1]) : null;
          })()}
          onNext={(() => {
            const idx = filtered.findIndex(x => x.key === selected.key);
            return idx !== -1 && idx < filtered.length - 1 ? () => setSelected(filtered[idx + 1]) : null;
          })()}
        />
      )}

      {showCatalogueExport && <CatalogueExport type="garment" rows={filtered} onClose={() => setShowCatalogueExport(false)} />}
    </>
  );
}

function GarmentModal({ garment: g, onClose, onEdit, onDelete, onPrev, onNext }) {
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {onPrev && <button className="modal-nav-btn prev" onClick={onPrev} title="Previous">‹</button>}
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-grid">
          <div className="modal-img no-blend">
            {g.image_url ? <img src={g.image_url} alt={g.excel_name} /> : <div className="no-img">NO IMAGE ON FILE</div>}
          </div>
          <div className="modal-body">
            <span className="cat-tag">{g.model_name || 'Garment'}</span>
            <h2 className="modal-title">{g.excel_name || g.customer_model}</h2>
            <div className="modal-brand">{g.brand}{g.color ? ` · ${g.color}` : ''}</div>
            <table className="detail-table">
              <tbody>
                <tr><td>Customer Model</td><td>{g.customer_model || '—'}</td></tr>
                <tr><td>Internal Model</td><td>{g.model1 || '—'}</td></tr>
                <tr><td>Description</td><td>{g.description || '—'}</td></tr>
                <tr><td>Origin</td><td>{g.origin || '—'}</td></tr>
                <tr><td>MOI / MFD</td><td>{[g.moi, g.mfd].filter(Boolean).join(' / ') || '—'}</td></tr>
                <tr><td>Master EAN</td><td>{g.master_ean || '—'}</td></tr>
                <tr><td>Master Article</td><td>{g.master_article || '—'}</td></tr>
                <tr><td>Month / Source</td><td>{[g.sheet, g.source_file].filter(Boolean).join(' · ') || '—'}</td></tr>
              </tbody>
            </table>

            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              Size run ({g.sizes.length})
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--rule)', borderRadius: 6, marginBottom: 18 }}>
              <table className="detail-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--ink)' }}>
                    <td style={{ fontWeight: 700 }}>Size</td>
                    <td style={{ fontWeight: 700 }}>Set Qty</td>
                    <td style={{ fontWeight: 700 }}>EAN</td>
                    <td style={{ fontWeight: 700 }}>Article</td>
                    <td style={{ fontWeight: 700 }}>MRP</td>
                    <td style={{ fontWeight: 700 }}>RRP</td>
                  </tr>
                </thead>
                <tbody>
                  {g.sizes.map((s, i) => (
                    <tr key={i}>
                      <td>{s.size || '—'}</td>
                      <td>{s.ratio ?? '—'}</td>
                      <td>{s.ean || '—'}</td>
                      <td>{s.article || '—'}</td>
                      <td>{fmtINR(s.mrp)}</td>
                      <td>{fmtINR(s.rrp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {onEdit && <button className="btn" onClick={onEdit}>✎ Edit</button>}
              {onDelete && <button className="btn btn-danger" onClick={onDelete}>🗑 Delete</button>}
            </div>
          </div>
        </div>
      </div>
      {onNext && <button className="modal-nav-btn next" onClick={onNext} title="Next">›</button>}
    </div>
  );
}
