import React, { useEffect, useMemo, useState } from 'react';

const escCsv = (value) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const clean = (value, fallback = 'image') => {
  const text = String(value ?? '').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return text || fallback;
};

const extFromUrl = (url) => {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const match = path.match(/\.([a-z0-9]{2,5})$/);
    if (match && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(match[1])) return match[1] === 'jpeg' ? 'jpg' : match[1];
  } catch {}
  return 'jpg';
};

function makeRows(type, sourceRows) {
  if (type === 'garment') {
    return sourceRows.map((g, index) => ({
      kind: 'Garment',
      category: g.model_name || 'Garments',
      brand: g.brand || '',
      name: g.excel_name || g.customer_model || g.model1 || g.description || `Garment ${index + 1}`,
      article: g.article || g.master_article || '',
      ean: g.ean || g.master_ean || '',
      model: g.customer_model || g.model1 || '',
      image_url: g.image_url || '',
      id: g.id || '',
    }));
  }
  return sourceRows.map((p, index) => ({
    kind: 'General Article',
    category: p.category || 'Uncategorized',
    brand: p.brand || '',
    name: p.description || p.model || p.article_no || `Article ${index + 1}`,
    article: p.article_no || '',
    ean: p.ean || '',
    model: p.model || '',
    image_url: p.image_url || '',
    id: p.id || '',
  }));
}

function makeStoredZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach(entry => {
    const name = encoder.encode(entry.path);
    const data = entry.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cv.set(name, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
}

let crcTable;
function crc32(data) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export default function ImageExport({ products = [], garments = [], onClose }) {
  const [type, setType] = useState('product');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [batchSize, setBatchSize] = useState(250);
  const [batch, setBatch] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState('');

  const sourceRows = type === 'garment' ? garments : products;
  const allRows = useMemo(() => makeRows(type === 'garment' ? 'garment' : 'product', sourceRows), [type, sourceRows]);

  const categories = useMemo(() => {
    const set = new Set(allRows.map(r => r.category).filter(Boolean));
    return [...set].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
  }, [allRows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter(r => {
      if (category !== 'all' && r.category !== category) return false;
      if (!q) return true;
      return [r.name, r.article, r.ean, r.model, r.brand, r.category].some(v => String(v).toLowerCase().includes(q));
    });
  }, [allRows, query, category]);

  const imageRows = useMemo(() => filteredRows.filter(r => r.image_url), [filteredRows]);
  const uniqueImageRows = useMemo(() => {
    const seen = new Set();
    return imageRows.filter(r => {
      if (seen.has(r.image_url)) return false;
      seen.add(r.image_url);
      return true;
    });
  }, [imageRows]);

  const totalBatches = Math.max(1, Math.ceil(uniqueImageRows.length / batchSize));
  const safeBatch = Math.min(batch, totalBatches);
  const currentBatch = uniqueImageRows.slice((safeBatch - 1) * batchSize, safeBatch * batchSize);

  useEffect(() => { setBatch(1); }, [type, query, category, batchSize]);

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function csvFor(rows) {
    const header = ['Type', 'Category', 'Brand', 'Name', 'Article No', 'EAN', 'Model', 'Image URL', 'Database ID'];
    const lines = [header.map(escCsv).join(',')];
    rows.forEach(r => lines.push([
      r.kind, r.category, r.brand, r.name, r.article, r.ean, r.model, r.image_url, r.id,
    ].map(escCsv).join(',')));
    return '\uFEFF' + lines.join('\r\n');
  }

  function exportManifest() {
    const blob = new Blob([csvFor(filteredRows)], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `article-ledger-${type === 'garment' ? 'garment' : 'product'}-image-manifest.csv`);
    setMessage(`Manifest exported for ${filteredRows.length.toLocaleString()} records.`);
  }

  async function downloadBatch() {
    if (!currentBatch.length || busy) return;
    setBusy(true);
    setMessage('');
    setProgress({ done: 0, total: currentBatch.length });
    const entries = [];
    let failed = 0;
    const usedNames = new Map();

    for (let i = 0; i < currentBatch.length; i += 1) {
      const row = currentBatch[i];
      try {
        const response = await fetch(row.image_url, { mode: 'cors', cache: 'force-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        const base = clean(row.article || row.ean || row.model || row.name, `image-${i + 1}`);
        const ext = extFromUrl(row.image_url);
        const key = `${row.category}/${base}`;
        const count = (usedNames.get(key) || 0) + 1;
        usedNames.set(key, count);
        const filename = `${base}${count > 1 ? `-${count}` : ''}.${ext}`;
        entries.push({ path: `${clean(row.category, 'Uncategorized')}/${filename}`, data: new Uint8Array(buffer) });
      } catch (err) {
        failed += 1;
      }
      setProgress({ done: i + 1, total: currentBatch.length });
    }

    try {
      const zipBlob = makeStoredZip(entries);
      downloadBlob(zipBlob, `article-ledger-${type === 'garment' ? 'garments' : 'products'}-images-batch-${safeBatch}-of-${totalBatches}.zip`);
      setMessage(`Batch ${safeBatch} exported: ${entries.length} downloaded${failed ? `, ${failed} failed` : ''}.`);
    } catch (err) {
      setMessage('The ZIP could not be created. Try a smaller batch size.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay image-export-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal image-export-modal" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => !busy && onClose()} disabled={busy}>✕</button>
        <div className="image-export-heading">
          <div>
            <div className="eyebrow">MEDIA UTILITY</div>
            <h2 className="modal-title">Product Image Export</h2>
            <p className="sub">Pull public Supabase Storage images into organized ZIP batches, or export the complete image manifest.</p>
          </div>
        </div>

        <div className="image-export-type-switch">
          <button className={type === 'product' ? 'active' : ''} onClick={() => setType('product')} disabled={busy}>General Articles <span>{products.length.toLocaleString()}</span></button>
          <button className={type === 'garment' ? 'active' : ''} onClick={() => setType('garment')} disabled={busy}>Garments <span>{garments.length.toLocaleString()}</span></button>
        </div>

        <div className="image-export-controls">
          <label>
            <span>Search</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Article, EAN, model, brand…" disabled={busy} />
          </label>
          <label>
            <span>Category</span>
            <select value={category} onChange={e => setCategory(e.target.value)} disabled={busy}>
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <span>Images per ZIP</span>
            <select value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} disabled={busy}>
              <option value="100">100</option>
              <option value="250">250</option>
              <option value="500">500</option>
              <option value="1000">1,000</option>
            </select>
          </label>
        </div>

        <div className="image-export-stats">
          <div><b>{filteredRows.length.toLocaleString()}</b><span>matching records</span></div>
          <div><b>{imageRows.length.toLocaleString()}</b><span>records with images</span></div>
          <div><b>{uniqueImageRows.length.toLocaleString()}</b><span>unique image URLs</span></div>
          <div><b>{totalBatches}</b><span>ZIP batches</span></div>
        </div>

        <div className="image-export-batch">
          <div className="batch-copy">
            <strong>Batch {safeBatch} of {totalBatches}</strong>
            <span>{currentBatch.length.toLocaleString()} unique images in this download</span>
          </div>
          <div className="batch-nav">
            <button className="btn" onClick={() => setBatch(v => Math.max(1, v - 1))} disabled={busy || safeBatch <= 1}>←</button>
            <select value={safeBatch} onChange={e => setBatch(Number(e.target.value))} disabled={busy} aria-label="ZIP batch">
              {Array.from({ length: totalBatches }, (_, i) => <option key={i + 1} value={i + 1}>Batch {i + 1}</option>)}
            </select>
            <button className="btn" onClick={() => setBatch(v => Math.min(totalBatches, v + 1))} disabled={busy || safeBatch >= totalBatches}>→</button>
          </div>
        </div>

        {busy && (
          <div className="image-export-progress">
            <div className="progress-track"><div style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} /></div>
            <span>Downloading {progress.done.toLocaleString()} / {progress.total.toLocaleString()} images…</span>
          </div>
        )}
        {message && <div className="image-export-message">{message}</div>}

        <div className="image-export-actions">
          <button className="btn" onClick={exportManifest} disabled={busy || !filteredRows.length}>Export Full CSV Manifest</button>
          <button className="btn btn-teal" onClick={downloadBatch} disabled={busy || !currentBatch.length}>{busy ? 'Preparing ZIP…' : `Download Batch ${safeBatch}`}</button>
        </div>
        <p className="image-export-note">Images stay in Supabase. This utility only reads their public URLs and creates a local copy in your browser. Smaller batches are recommended for large image libraries.</p>
      </div>
    </div>
  );
}
