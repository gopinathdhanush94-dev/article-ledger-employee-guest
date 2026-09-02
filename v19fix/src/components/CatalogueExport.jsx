import React, { useState } from 'react';

const GENERAL_FIELDS = [
  ['description', 'Description', true], ['brand', 'Brand', true], ['category', 'Category', true], ['model', 'Model', false],
  ['ean', 'EAN', true], ['mrp', 'MRP', false], ['sp', 'Selling Price', false], ['discount', 'Discount %', false],
  ['hsn', 'HSN', false], ['article_no', 'Article No', false], ['month', 'Month', true], ['year', 'Year', false],
  ['marketed_by', 'Marketed By', false], ['master_qty', 'Master Qty', false], ['inner_qty', 'Inner Qty', false],
  ['sku', 'SKU Dimensions / Weight', false], ['master', 'Master Dimensions / Weight', false], ['inner', 'Inner Dimensions / Weight', false],
];

const GARMENT_FIELDS = [
  ['excel_name', 'Style Name', true], ['model_name', 'Garment Type', true], ['brand', 'Brand', true], ['color', 'Color', true],
  ['customer_model', 'Customer Model', false], ['model1', 'Internal Model', false], ['description', 'Description', false], ['origin', 'Origin', false],
  ['moi', 'MOI', false], ['mfd', 'MFD', false], ['master_ean', 'Master EAN', false], ['master_article', 'Master Article', false],
  ['month', 'Month', true], ['year', 'Year', false], ['sizes', 'Size Details', true],
];

export default function CatalogueExport({ type, rows, onClose }) {
  const fields = type === 'garment' ? GARMENT_FIELDS : GENERAL_FIELDS;
  const [selected, setSelected] = useState(() => new Set(fields.filter(f => f[2]).map(f => f[0])));
  const [includeImage, setIncludeImage] = useState(true);

  const toggle = (key) => setSelected(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  function exportCatalogue() {
    const chosen = fields.filter(f => selected.has(f[0])).map(f => f[0]);
    if (!chosen.length && !includeImage) return;
    const html = type === 'garment'
      ? buildGarmentHtml(rows, chosen, includeImage)
      : buildGeneralHtml(rows, chosen, includeImage);
    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups for this site to export the catalogue.'); return; }
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
      onClose();
    } catch (err) {
      try { win.close(); } catch {}
      alert('Unable to create the catalogue window. Please allow pop-ups for this site.');
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal catalogue-export-modal" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">Catalogue Export</h2>
        <p className="sub">Choose exactly what should appear in the catalogue. The current filters are already applied.</p>
        <label className="export-image-toggle">
          <input type="checkbox" checked={includeImage} onChange={e => setIncludeImage(e.target.checked)} />
          <span>Include product image</span>
        </label>
        <div className="export-field-grid">
          {fields.map(([key, label]) => (
            <label key={key} className="export-field-option">
              <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="catalogue-export-actions">
          <button className="btn" onClick={() => setSelected(new Set(fields.map(f => f[0])))}>Select all</button>
          <button className="btn" onClick={() => setSelected(new Set())}>Clear all</button>
          <button className="btn btn-teal" onClick={exportCatalogue}>Create Catalogue</button>
        </div>
      </div>
    </div>
  );
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => v == null || v === '' ? '' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const label = (name, value) => value == null || value === '' ? '' : `<div class="field"><b>${esc(name)}</b><span>${esc(value)}</span></div>`;

function buildGeneralHtml(rows, chosen, includeImage) {
  const cards = rows.map(p => {
    const off = p.mrp && p.sp ? Math.round(((Number(p.mrp) - Number(p.sp)) / Number(p.mrp)) * 100) : '';
    const fields = [
      chosen.includes('description') && label('Description', p.description), chosen.includes('brand') && label('Brand', p.brand),
      chosen.includes('category') && label('Category', p.category), chosen.includes('model') && label('Model', p.model),
      chosen.includes('ean') && label('EAN', p.ean), chosen.includes('mrp') && label('MRP', money(p.mrp)),
      chosen.includes('sp') && label('Selling Price', money(p.sp)), chosen.includes('discount') && label('Discount %', off === '' ? '' : `${off}%`),
      chosen.includes('hsn') && label('HSN', p.hsn), chosen.includes('article_no') && label('Article No', p.article_no),
      chosen.includes('month') && label('Month', p.month), chosen.includes('year') && label('Year', p.month?.match(/20\d{2}/)?.[0]),
      chosen.includes('marketed_by') && label('Marketed By', p.marketed_by), chosen.includes('master_qty') && label('Master Qty', p.master_qty),
      chosen.includes('inner_qty') && label('Inner Qty', p.inner_qty), chosen.includes('sku') && label('SKU', dims(p, 'sku')),
      chosen.includes('master') && label('Master', dims(p, 'master')), chosen.includes('inner') && label('Inner', dims(p, 'inner')),
    ].filter(Boolean).join('');
    return cardHtml(includeImage ? p.image_url : '', p.description || p.model || 'Article', fields);
  }).join('');
  return shell('Article Catalogue', cards);
}

function dims(p, prefix) {
  const vals = [p[`${prefix}_l`], p[`${prefix}_w`], p[`${prefix}_h`]].filter(v => v !== null && v !== undefined && v !== '').join(' × ');
  const unit = p[`${prefix}_dim_unit`] || '';
  const nw = p[`${prefix}_nw`], gw = p[`${prefix}_gw`], wt = p[`${prefix}_wt_unit`] || '';
  const weight = nw || gw ? ` | NW ${nw ?? ''} / GW ${gw ?? ''} ${wt}` : '';
  return `${vals}${unit ? ` ${unit}` : ''}${weight}`.trim();
}

function buildGarmentHtml(rows, chosen, includeImage) {
  const cards = rows.map(g => {
    const fields = [
      chosen.includes('excel_name') && label('Style Name', g.excel_name), chosen.includes('model_name') && label('Garment Type', g.model_name),
      chosen.includes('brand') && label('Brand', g.brand), chosen.includes('color') && label('Color', g.color),
      chosen.includes('customer_model') && label('Customer Model', g.customer_model), chosen.includes('model1') && label('Internal Model', g.model1),
      chosen.includes('description') && label('Description', g.description), chosen.includes('origin') && label('Origin', g.origin),
      chosen.includes('moi') && label('MOI', g.moi), chosen.includes('mfd') && label('MFD', g.mfd),
      chosen.includes('master_ean') && label('Master EAN', g.master_ean), chosen.includes('master_article') && label('Master Article', g.master_article),
      chosen.includes('month') && label('Month', g.sheet), chosen.includes('year') && label('Year', g.year),
      chosen.includes('sizes') && sizeTable(g.sizes),
    ].filter(Boolean).join('');
    return cardHtml(includeImage ? g.image_url : '', g.excel_name || g.customer_model || 'Garment', fields);
  }).join('');
  return shell('Garment Catalogue', cards);
}

function sizeTable(sizes = []) {
  if (!sizes.length) return '';
  const rows = sizes.map(s => `<tr><td>${esc(s.size)}</td><td>${esc(s.ratio ?? '')}</td><td>${esc(s.ean)}</td><td>${esc(s.article)}</td><td>${money(s.mrp)}</td><td>${money(s.rrp)}</td></tr>`).join('');
  return `<div class="size-block"><b>Size Details</b><table><thead><tr><th>Size</th><th>Qty</th><th>EAN</th><th>Article</th><th>MRP</th><th>RRP</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function cardHtml(image, title, fields) {
  return `<article class="card">${image ? `<div class="image-wrap"><img src="${esc(image)}" alt="${esc(title)}" /></div>` : ''}<div class="content"><h2>${esc(title)}</h2><div class="fields">${fields}</div></div></article>`;
}

function shell(title, cards) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#222;background:#fff;margin:0}.toolbar{position:sticky;top:0;background:#222;color:#fff;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;z-index:5}.toolbar button{border:0;border-radius:5px;padding:9px 15px;font-weight:700;cursor:pointer}.wrap{max-width:1100px;margin:auto;padding:18px}.catalogue-title{text-align:center;margin:8px 0 20px;font-size:25px}.card{display:grid;grid-template-columns:180px 1fr;gap:20px;border:1px solid #ccc;border-radius:8px;padding:14px;margin-bottom:18px;break-inside:avoid;page-break-inside:avoid}.image-wrap{height:170px;display:flex;align-items:center;justify-content:center;border:1px solid #e3e3e3;border-radius:6px;overflow:hidden}.image-wrap img{max-width:100%;max-height:100%;object-fit:contain}.content h2{font-size:19px;margin:2px 0 12px}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 18px}.field{font-size:12px;border-bottom:1px solid #eee;padding:3px 0}.field b{display:block;color:#666;font-size:9px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}.size-block{grid-column:1/-1;margin-top:5px}.size-block>b{display:block;margin-bottom:5px;font-size:12px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ddd;padding:4px;text-align:left}th{background:#f2f2f2} .print-note{font-size:11px;color:#666;text-align:center;margin-bottom:12px}@media print{.toolbar{display:none}.wrap{padding:0}.card{border:1px solid #aaa}.image-wrap{height:145px}}
  </style></head><body><div class="toolbar"><span>${esc(title)}</span><button onclick="window.print()">Print / Save as PDF</button></div><div class="wrap"><h1 class="catalogue-title">${esc(title)}</h1><div class="print-note">Generated from the currently filtered records</div>${cards}</div><script>window.addEventListener('load',()=>{const imgs=[...document.images];Promise.all(imgs.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=i.onerror=r}))).then(()=>setTimeout(()=>window.print(),400));});</script></body></html>`;
}
