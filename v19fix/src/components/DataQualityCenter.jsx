import React, { useMemo, useState } from 'react';

function completeProduct(p) {
  const required = ['description','category','brand','model','ean','hsn','article_no','image_url','mrp','sp'];
  return required.every(k => p[k] !== null && p[k] !== undefined && String(p[k]).trim() !== '');
}

const CHECKS = [
  ['image', 'Missing Images', p => !p.image_url],
  ['article', 'Missing Article No.', p => !p.article_no],
  ['ean', 'Missing EAN', p => !p.ean],
  ['hsn', 'Missing HSN', p => !p.hsn],
  ['price', 'Missing Price', p => p.mrp == null && p.sp == null],
  ['model', 'Missing Model', p => !p.model],
];

export default function DataQualityCenter({ open, onClose, products, onGoToCatalog }) {
  const [qualityFilter, setQualityFilter] = useState('all');

  const quality = useMemo(() => {
    const out = Object.fromEntries(CHECKS.map(([k, label, fn]) => [
      k,
      { label, count: products.filter(fn).length },
    ]));
    const complete = products.filter(completeProduct).length;
    return { ...out, complete, total: products.length };
  }, [products]);

  const qualityRows = useMemo(() => {
    const fn = Object.fromEntries(CHECKS.map(([k, , check]) => [k, check]));
    if (qualityFilter === 'all') return [];
    return products.filter(fn[qualityFilter] || (() => false)).slice(0, 100);
  }, [products, qualityFilter]);

  if (!open) return null;

  const total = Math.max(quality.total, 1);
  const completion = Math.round((quality.complete / total) * 100);

  function close() {
    setQualityFilter('all');
    onClose?.();
  }

  function openRecord(p) {
    close();
    onGoToCatalog?.({ search: p.ean || p.description || p.model, autoOpen: true });
  }

  return (
    <div className="quality-overlay" role="dialog" aria-modal="true" aria-labelledby="quality-title" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="quality-modal glass-panel">
        <button type="button" className="modal-close" onClick={close} aria-label="Close Data Quality Center">×</button>

        <div className="quality-modal-header">
          <div>
            <span className="eyebrow">MASTER DATA CONTROL</span>
            <h2 id="quality-title">Data Quality Center</h2>
            <p>Review incomplete article master data and jump directly to the affected records.</p>
          </div>
          <div className={`quality-score large ${completion >= 90 ? 'good' : ''}`}>
            <strong>{completion}%</strong>
            <span>complete</span>
          </div>
        </div>

        <div className="quality-progress large"><span style={{ width: `${completion}%` }} /></div>

        <div className="quality-grid modal-quality-grid">
          {CHECKS.map(([k]) => (
            <button key={k} type="button" className={`quality-card ${quality[k].count ? 'warning' : ''} ${qualityFilter === k ? 'selected' : ''}`} onClick={() => setQualityFilter(k)}>
              <strong>{quality[k].count}</strong>
              <span>{quality[k].label}</span>
            </button>
          ))}
        </div>

        {qualityFilter === 'all' ? (
          <div className="quality-summary-note">
            <strong>{quality.complete}</strong> of <strong>{quality.total}</strong> articles currently contain all required master-data fields.
          </div>
        ) : (
          <div className="quality-results modal-quality-results">
            <div className="panel-heading-row">
              <div>
                <strong>{quality[qualityFilter].label}</strong>
                <div className="panel-hint">Showing up to 100 records.</div>
              </div>
              <button type="button" className="text-button" onClick={() => setQualityFilter('all')}>Clear</button>
            </div>
            {qualityRows.length === 0 ? (
              <div className="quality-empty">No matching records.</div>
            ) : qualityRows.map(p => (
              <button type="button" className="quality-result-row" key={p.id} onClick={() => openRecord(p)}>
                <span>{p.description || p.model || 'Unnamed article'}</span>
                <small>{p.ean || 'No EAN'} · {p.brand || 'No brand'} · {p.article_no || 'No Article No.'}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
