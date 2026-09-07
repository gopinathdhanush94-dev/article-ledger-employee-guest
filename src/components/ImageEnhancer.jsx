import React, { useEffect, useMemo, useState } from 'react';

function labelFor(row, index) {
  return row.article_no || row.ean || row.model || row.description || `Product ${index + 1}`;
}

function uniqueImageProducts(products) {
  const seen = new Set();
  return (products || []).filter(p => p?.image_url && !seen.has(p.image_url) && seen.add(p.image_url));
}

export default function ImageEnhancer({ products = [], onClose }) {
  const rows = useMemo(() => uniqueImageProducts(products), [products]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(p => [
      p.article_no, p.ean, p.model, p.description, p.category, p.brand
    ].some(v => String(v || '').toLowerCase().includes(q)));
  }, [rows, query]);

  useEffect(() => {
    if (!selected.length && rows.length) setSelected(rows.slice(0, 10).map(p => p.image_url));
  }, [rows, selected.length]);

  function toggle(url) {
    setSelected(current => current.includes(url)
      ? current.filter(v => v !== url)
      : current.length >= 10 ? current : [...current, url]);
  }

  function selectFirstTen() {
    setSelected(filtered.slice(0, 10).map(p => p.image_url));
    setMessage('');
  }

  async function enhance() {
    if (!selected.length || busy) return;
    setBusy(true);
    setMessage('');
    const next = { ...results };
    let done = 0;
    for (const url of selected) {
      const product = rows.find(p => p.image_url === url);
      try {
        const response = await fetch('/api/gemini-enhance-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: url, aspectRatio: '1:1', imageSize: '2K' })
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${response.status}`);
        }
        const blob = await response.blob();
        next[url] = {
          status: 'done',
          original: url,
          enhanced: URL.createObjectURL(blob),
          name: labelFor(product, rows.indexOf(product))
        };
      } catch (error) {
        next[url] = { status: 'error', original: url, error: error.message };
      }
      done += 1;
      setResults({ ...next });
      setMessage(`Enhanced ${done} of ${selected.length}`);
    }
    setBusy(false);
    setMessage(`Test complete — ${selected.length} image${selected.length === 1 ? '' : 's'} processed.`);
  }

  function download(url) {
    const item = results[url];
    if (!item?.enhanced) return;
    const a = document.createElement('a');
    a.href = item.enhanced;
    a.download = `${(item.name || 'enhanced-product').replace(/[^a-z0-9_-]+/gi, '_')}-gemini.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const doneCount = selected.filter(url => results[url]?.status === 'done').length;

  return (
    <div className="overlay image-enhancer-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal image-enhancer-modal" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => !busy && onClose()} disabled={busy}>✕</button>

        <div className="image-enhancer-heading">
          <div>
            <div className="eyebrow">GEMINI IMAGE STUDIO</div>
            <h2 className="modal-title">Product Image Enhancement</h2>
            <p className="sub">Test Gemini on up to 10 catalogue images. Originals stay untouched until you approve the results.</p>
          </div>
          <div className="image-enhancer-badge">10-image test</div>
        </div>

        <div className="image-enhancer-toolbar">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search article, EAN, model, category…"
            disabled={busy}
          />
          <button className="btn" onClick={selectFirstTen} disabled={busy || !filtered.length}>Auto-select first 10</button>
          <span className="image-enhancer-count">{selected.length}/10 selected</span>
        </div>

        <div className="image-enhancer-picker">
          {filtered.slice(0, 60).map((product, index) => {
            const active = selected.includes(product.image_url);
            const result = results[product.image_url];
            return (
              <button
                key={product.image_url}
                type="button"
                className={`image-enhancer-item ${active ? 'selected' : ''}`}
                onClick={() => toggle(product.image_url)}
                disabled={busy}
                title={labelFor(product, index)}
              >
                <img src={product.image_url} alt="" loading="lazy" />
                <span>{labelFor(product, index)}</span>
                {result?.status === 'done' && <b>✓</b>}
              </button>
            );
          })}
        </div>

        <div className="image-enhancer-actions">
          <div>
            <strong>{doneCount} enhanced</strong>
            <span>{message || 'Select the poorest/blurriest product images for the first test.'}</span>
          </div>
          <button className="access-submit image-enhancer-run" onClick={enhance} disabled={busy || !selected.length}>
            {busy ? 'Enhancing with Gemini…' : 'Enhance selected images'}
          </button>
        </div>

        {selected.length > 0 && (
          <div className="image-enhancer-results">
            {selected.map(url => {
              const product = rows.find(p => p.image_url === url);
              const result = results[url];
              return (
                <div className="image-enhancer-result" key={url}>
                  <div className="image-enhancer-result-head">
                    <strong>{labelFor(product, rows.indexOf(product))}</strong>
                    {result?.status === 'done' && <button className="btn" onClick={() => download(url)}>Download</button>}
                  </div>
                  <div className="image-enhancer-compare">
                    <figure><img src={url} alt="Original" /><figcaption>Original</figcaption></figure>
                    <figure>
                      {result?.enhanced
                        ? <img src={result.enhanced} alt="Gemini enhanced" />
                        : <div className="image-enhancer-placeholder">{result?.error ? `Error: ${result.error}` : busy ? 'Processing…' : 'Waiting for test'}</div>}
                      <figcaption>Gemini enhanced</figcaption>
                    </figure>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
