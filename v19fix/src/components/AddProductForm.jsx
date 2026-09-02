import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { isValidEan, uniqueSorted, monthOptions, normalizeMonthValue } from '../lib/helpers.js';
import Autocomplete from './Autocomplete.jsx';
import { useDialogs } from './Dialogs.jsx';

const BLANK = {
  id: null, category: '', brand: '', model: '', description: '', ean: '', hsn: '',
  mrp: '', sp: '', master_qty: '', inner_qty: '', article_no: '', marketed_by: '', month: '',
  sku_l: '', sku_w: '', sku_h: '', sku_dim_unit: 'CM', sku_nw: '', sku_gw: '', sku_wt_unit: 'KG',
  master_l: '', master_w: '', master_h: '', master_dim_unit: 'CM', master_nw: '', master_gw: '', master_wt_unit: 'KG',
  inner_l: '', inner_w: '', inner_h: '', inner_dim_unit: 'CM', inner_nw: '', inner_gw: '', inner_wt_unit: 'KG',
  image_url: null,
};

export default function AddProductForm({ products, editingProduct, onSaved, onCancel, readOnly = false }) {
  const dialogs = useDialogs();
  const [form, setForm] = useState(BLANK);
  const [ eanError, setEanError ] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState([]);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [editTab, setEditTab] = useState('core');

  useEffect(() => {
    if (editingProduct) {
      const p = editingProduct;
      setForm({
        ...BLANK,
        ...Object.fromEntries(Object.keys(BLANK).map(k => [k, p[k] ?? BLANK[k]])),
        id: p.id,
      });
      setImagePreview(p.image_url || null);
    } else {
      setForm(BLANK);
      setImagePreview(null);
    }
    setImageFile(null);
    setEanError('');
  }, [editingProduct]);

  const categories = uniqueSorted(products, 'category');
  const brands = uniqueSorted(products, 'brand');
  const hsns = uniqueSorted(products, 'hsn');
  const marketers = uniqueSorted(products, 'marketed_by');
  const months = monthOptions(products);

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
  }

  function setImageFromFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  function handleImageChange(e) {
    const file = e.target.files[0];
    setImageFromFile(file);
  }

  const [dragActive, setDragActive] = useState(false);

  function handleDragOver(e) {
    e.preventDefault();
    setDragActive(true);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    setDragActive(false);
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);

    // Dropped straight from a local folder / the desktop.
    const file = e.dataTransfer.files?.[0];
    if (file) { setImageFromFile(file); return; }

    // Dropped from a webpage (an <img> dragged out of a browser tab) — the
    // browser gives us the image's URL, not the file itself, so fetch it.
    const html = e.dataTransfer.getData('text/html');
    const uriList = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('URL');
    let url = uriList;
    if (!url && html) {
      const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match) url = match[1];
    }
    if (!url) return;

    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('Could not fetch that image');
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('That link is not an image');
      const filename = url.split('/').pop().split('?')[0] || 'dropped-image.jpg';
      const file = new File([blob], filename, { type: blob.type });
      setImageFromFile(file);
    } catch (err) {
      dialogs.alertDialog({
        title: 'Could not use that image',
        message: 'That website blocks other sites from copying its images directly. Save the image to your computer first (right-click → Save Image As), then drag the saved file in instead.',
      });
    }
  }

  function openAddNewDialog(field, label) {
    dialogs.promptDialog({
      title: `Add a new ${label}`,
      message: `Type the new ${label} you'd like to use for this article.`,
      placeholder: `New ${label}`,
      confirmLabel: 'Use this value',
      onConfirm: (val, { setError }) => {
        const v = (val || '').trim();
        if (!v) { setError(`Please enter a ${label}.`); return; }
        set(field, v);
        dialogs.close();
      },
    });
  }

  async function eanExists(ean, excludeId) {
    let query = supabase.from('products').select('id').eq('ean', ean).limit(1);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query;
    return data && data.length > 0;
  }

  function numOrNull(v) {
    return v === '' || v == null ? null : parseFloat(v);
  }

  const REASON_FIELDS = [
    { key: 'ean', label: 'EAN Code', getForm: () => (form.ean || '').trim() || null, getOriginal: () => editingProduct?.ean ?? null },
    { key: 'article_no', label: 'Article No.', getForm: () => (form.article_no || '').trim() || null, getOriginal: () => editingProduct?.article_no ?? null },
    { key: 'description', label: 'Description', getForm: () => (form.description || '').trim() || null, getOriginal: () => editingProduct?.description ?? null },
    { key: 'brand', label: 'Brand', getForm: () => (form.brand || '').trim() || null, getOriginal: () => editingProduct?.brand ?? null },
    { key: 'category', label: 'Category', getForm: () => (form.category || '').trim() || null, getOriginal: () => editingProduct?.category ?? null },
    { key: 'model', label: 'Model', getForm: () => (form.model || '').trim() || null, getOriginal: () => editingProduct?.model ?? null },
    { key: 'hsn', label: 'HSN Code', getForm: () => form.hsn.trim() || null, getOriginal: () => editingProduct?.hsn ?? null },
    { key: 'mrp', label: 'MRP', getForm: () => numOrNull(form.mrp), getOriginal: () => editingProduct?.mrp ?? null },
    { key: 'sp', label: 'Selling Price', getForm: () => numOrNull(form.sp), getOriginal: () => editingProduct?.sp ?? null },
    { key: 'master_qty', label: 'Master Ctn Qty', getForm: () => (form.master_qty === '' ? null : parseInt(form.master_qty, 10)), getOriginal: () => editingProduct?.master_qty ?? null },
    { key: 'inner_qty', label: 'Inner Ctn Qty', getForm: () => (form.inner_qty === '' ? null : parseInt(form.inner_qty, 10)), getOriginal: () => editingProduct?.inner_qty ?? null },
  ];

  // Numeric database columns (mrp, sp) come back from Supabase as strings, while
  // the form always produces numbers — a plain !== would treat those as "changed"
  // (or fail to notice a real change) purely due to type, not value. Compare the
  // numeric value when both sides parse as numbers; otherwise compare as text.
  function valuesEqual(a, b) {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na === nb;
    return String(a) === String(b);
  }

  function getChangedReasonFields() {
    if (!form.id || !editingProduct) return [];
    return REASON_FIELDS.filter(f => !valuesEqual(f.getForm(), f.getOriginal()));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEanError('');

    const ean = (form.ean || '').trim();
    if (!isValidEan(ean)) {
      setEanError('EAN Code must be exactly 13 digits.');
      return;
    }
    if (await eanExists(ean, form.id)) {
      setEanError('This EAN already exists in the catalog — each article needs a unique EAN.');
      return;
    }

    const changedFields = getChangedReasonFields();

    if (changedFields.length > 0) {
      dialogs.promptDialog({
        title: 'Reason for this change',
        message: `You're changing: ${changedFields.map(f => f.label).join(', ')}. Please note why, for the record.`,
        placeholder: 'e.g. Price correction from supplier, quantity recount, EAN was mistyped…',
        confirmLabel: 'Continue',
        onConfirm: (reasonText, { setError }) => {
          const reason = (reasonText || '').trim();
          if (!reason) { setError('Please enter a reason before continuing.'); return; }
          dialogs.close();
          confirmAndSave(ean, reason);
        },
      });
    } else {
      confirmAndSave(ean, null);
    }
  }

  function confirmAndSave(ean, reason) {
    dialogs.confirmDialog({
      title: form.id ? 'Save changes to this article?' : 'Add this article?',
      message: form.id
        ? 'This will update the article with what you\'ve entered in the form.'
        : 'Double-check the form — once confirmed, this article is saved right away.',
      confirmLabel: form.id ? 'Save Changes' : 'Add Article',
      onConfirm: () => performSave(ean, reason),
    });
  }

  async function performSave(ean, reason) {
    setSaving(true);
    try {
      let imageUrl = form.image_url;
      if (imageFile) {
        const filename = `${Date.now()}-${imageFile.name.replace(/[^a-z0-9.]/gi, '_')}`;
        const { error: upErr } = await supabase.storage.from('product-images').upload(filename, imageFile, { upsert: true });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('product-images').getPublicUrl(filename);
        imageUrl = data.publicUrl;
      }

      const row = {
        category: form.category.trim(),
        brand: form.brand.trim(),
        model: form.model.trim() || null,
        description: form.description.trim() || null,
        ean,
        hsn: form.hsn.trim() || null,
        mrp: numOrNull(form.mrp),
        sp: numOrNull(form.sp),
        master_qty: form.master_qty === '' ? null : parseInt(form.master_qty, 10),
        inner_qty: form.inner_qty === '' ? null : parseInt(form.inner_qty, 10),
        article_no: form.article_no.trim() || null,
        marketed_by: form.marketed_by.trim() || null,
        month: normalizeMonthValue(form.month),
        sku_l: numOrNull(form.sku_l), sku_w: numOrNull(form.sku_w), sku_h: numOrNull(form.sku_h),
        sku_dim_unit: form.sku_dim_unit, sku_nw: numOrNull(form.sku_nw), sku_gw: numOrNull(form.sku_gw), sku_wt_unit: form.sku_wt_unit,
        master_l: numOrNull(form.master_l), master_w: numOrNull(form.master_w), master_h: numOrNull(form.master_h),
        master_dim_unit: form.master_dim_unit, master_nw: numOrNull(form.master_nw), master_gw: numOrNull(form.master_gw), master_wt_unit: form.master_wt_unit,
        inner_l: numOrNull(form.inner_l), inner_w: numOrNull(form.inner_w), inner_h: numOrNull(form.inner_h),
        inner_dim_unit: form.inner_dim_unit, inner_nw: numOrNull(form.inner_nw), inner_gw: numOrNull(form.inner_gw), inner_wt_unit: form.inner_wt_unit,
        image_url: imageUrl,
        custom: true,
        pending_change_reason: reason || null,
      };

      if (form.id) {
        const { error } = await supabase.from('products').update(row).eq('id', form.id);
        if (error) throw error;
        onSaved(true, ean);
      } else {
        const { error } = await supabase.from('products').insert(row);
        if (error) throw error;
        onSaved(false, ean);
      }
    } catch (err) {
      dialogs.alertDialog({ title: 'Could not save article', message: err.message || String(err) });
    } finally {
      setSaving(false);
    }
  }

  // ---- Bulk upload ----
  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* skip */ }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(v => v.trim() !== ''));
  }

  const BULK_HEADERS = ['Description', 'Category', 'Brand', 'Model', 'EAN', 'HSN', 'MRP', 'SP', 'Article No', 'Marketed By',
    'Master Qty', 'Inner Qty', 'Month',
    'SKU L', 'SKU W', 'SKU H', 'SKU Dim Unit', 'SKU Net Wt', 'SKU Gross Wt', 'SKU Weight Unit',
    'Master L', 'Master W', 'Master H', 'Master Dim Unit', 'Master Net Wt', 'Master Gross Wt', 'Master Weight Unit',
    'Inner L', 'Inner W', 'Inner H', 'Inner Dim Unit', 'Inner Net Wt', 'Inner Gross Wt', 'Inner Weight Unit'];

  function downloadBulkTemplate() {
    const csv = BULK_HEADERS.join(',') + '\r\n';
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'article-ledger-bulk-template.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleBulkFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    e.target.value = '';
    if (rows.length < 2) { setBulkResult([{ label: 'File', ok: false, msg: 'No data rows found' }]); return; }

    const header = rows[0].map(h => h.trim().toLowerCase());
    const idx = (name) => header.indexOf(name.toLowerCase());
    const get = (r, name) => { const i = idx(name); return i >= 0 ? (r[i] || '').trim() : ''; };
    const num = (v) => v === '' || v == null ? null : (isNaN(parseFloat(v)) ? null : parseFloat(v));

    const log = [];
    const seen = new Set();
    let added = 0;
    const totalRows = rows.length - 1;
    setBulkProgress({ current: 0, total: totalRows });

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const desc = get(r, 'Description');
      const ean = get(r, 'EAN').replace(/\D/g, '');
      const label = desc || ean || `Row ${i + 1}`;

      if (!isValidEan(ean)) { log.push({ label, ok: false, msg: 'invalid EAN (needs 13 digits)' }); setBulkProgress({ current: i, total: totalRows }); continue; }
      if (seen.has(ean) || await eanExists(ean, null)) { log.push({ label, ok: false, msg: 'duplicate EAN — skipped' }); setBulkProgress({ current: i, total: totalRows }); continue; }
      seen.add(ean);

      const row = {
        month: normalizeMonthValue(get(r, 'Month')) || 'CUSTOM',
        category: get(r, 'Category') || 'Uncategorized',
        brand: get(r, 'Brand') || 'Unbranded',
        model: get(r, 'Model') || null,
        description: desc || null,
        ean,
        mrp: num(get(r, 'MRP')), sp: num(get(r, 'SP')),
        hsn: get(r, 'HSN') || null,
        article_no: get(r, 'Article No') || null,
        marketed_by: get(r, 'Marketed By') || null,
        master_qty: num(get(r, 'Master Qty')), inner_qty: num(get(r, 'Inner Qty')),
        sku_l: num(get(r, 'SKU L')), sku_w: num(get(r, 'SKU W')), sku_h: num(get(r, 'SKU H')),
        sku_dim_unit: (get(r, 'SKU Dim Unit') || 'CM').toUpperCase(),
        sku_nw: num(get(r, 'SKU Net Wt')), sku_gw: num(get(r, 'SKU Gross Wt')),
        sku_wt_unit: (get(r, 'SKU Weight Unit') || 'KG').toUpperCase(),
        master_l: num(get(r, 'Master L')), master_w: num(get(r, 'Master W')), master_h: num(get(r, 'Master H')),
        master_dim_unit: (get(r, 'Master Dim Unit') || 'CM').toUpperCase(),
        master_nw: num(get(r, 'Master Net Wt')), master_gw: num(get(r, 'Master Gross Wt')),
        master_wt_unit: (get(r, 'Master Weight Unit') || 'KG').toUpperCase(),
        inner_l: num(get(r, 'Inner L')), inner_w: num(get(r, 'Inner W')), inner_h: num(get(r, 'Inner H')),
        inner_dim_unit: (get(r, 'Inner Dim Unit') || 'CM').toUpperCase(),
        inner_nw: num(get(r, 'Inner Net Wt')), inner_gw: num(get(r, 'Inner Gross Wt')),
        inner_wt_unit: (get(r, 'Inner Weight Unit') || 'KG').toUpperCase(),
        custom: true,
      };
      const { error } = await supabase.from('products').insert(row);
      if (error) { log.push({ label, ok: false, msg: error.message }); setBulkProgress({ current: i, total: totalRows }); continue; }
      added++;
      log.push({ label, ok: true, msg: 'added' });
      setBulkProgress({ current: i, total: totalRows });
    }

    setBulkProgress(null);
    setBulkResult(log);
    if (added > 0) onSaved();
  }

  return (
    <div className="form-wrap">
      <div className="form-card editor-card">
        <div className="editor-header">
          <div><span className="eyebrow">PRODUCT MASTER</span><h2>{form.id ? 'Edit Article' : 'Add a New Article'}</h2><div className="sub">{form.id ? 'Update the article in focused sections. Your changes are tracked.' : 'Create a complete article record with guided sections.'}</div></div>
          <div className="editor-status">{form.id ? 'Editing existing record' : 'New record'}</div>
        </div>
        <div className="editor-tabs" role="tablist">
          {[['core','Core Details'],['commercial','Commercial'],['logistics','Logistics'],['media','Image']].map(([key,label])=><button type="button" key={key} className={editTab===key?'active':''} onClick={()=>setEditTab(key)}>{label}</button>)}
        </div>
        <form onSubmit={handleSubmit}>
          {readOnly && <div className="um-readonly-banner">View only — your role can open Add Product, but cannot create or edit catalogue records.</div>}
          <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          {editTab==='core' && <div className="form-grid editor-section">
            <div className="field full"><div className="section-intro"><strong>Identity & classification</strong><span>Use the EAN as the unique product identity.</span></div></div>
            <div className="field"><label>Description <span className="req">*</span></label><input type="text" required value={form.description} onChange={e=>set('description',e.target.value)} placeholder="e.g. 5 Pcs Kitchen Tool Set" /></div>
            <div className="field"><label>Category <span className="req">*</span></label><div className="field-with-add"><Autocomplete value={form.category} onChange={v=>set('category',v)} options={categories} required placeholder="e.g. Kitchen Utility"/><button type="button" className="add-new-btn" onClick={()=>openAddNewDialog('category','category')}>+</button></div></div>
            <div className="field"><label>Brand <span className="req">*</span></label><div className="field-with-add"><Autocomplete value={form.brand} onChange={v=>set('brand',v)} options={brands} required placeholder="e.g. White Label"/><button type="button" className="add-new-btn" onClick={()=>openAddNewDialog('brand','brand')}>+</button></div></div>
            <div className="field"><label>Model</label><input type="text" value={form.model} onChange={e=>set('model',e.target.value)} placeholder="e.g. FK1380" /></div>
            <div className="field"><label>EAN Code <span className="req">*</span></label><input type="text" inputMode="numeric" maxLength={13} required value={form.ean} onChange={e=>{set('ean',e.target.value.replace(/\D/g,'').slice(0,13));setEanError('')}} placeholder="13 digits" />{eanError&&<div className="field-error">{eanError}</div>}</div>
            <div className="field"><label>HSN Code</label><div className="field-with-add"><Autocomplete value={form.hsn} onChange={v=>set('hsn',v)} options={hsns} placeholder="e.g. 8215"/><button type="button" className="add-new-btn" onClick={()=>openAddNewDialog('hsn','HSN code')}>+</button></div></div>
            <div className="field"><label>Article No.</label><input type="text" value={form.article_no} onChange={e=>set('article_no',e.target.value)} placeholder="e.g. 494403226" /></div>
            <div className="field"><label>Marketed By</label><Autocomplete value={form.marketed_by} onChange={v=>set('marketed_by',v)} options={marketers} placeholder="e.g. Gsons" /></div>
            <div className="field"><label>Month / Batch</label><div className="field-with-add"><Autocomplete value={form.month} onChange={v=>set('month',v)} options={months} placeholder="e.g. JUL-26"/><button type="button" className="add-new-btn" onClick={()=>openAddNewDialog('month','month / batch')}>+</button></div></div>
          </div>}

          {editTab==='commercial' && <div className="form-grid editor-section">
            <div className="field full"><div className="section-intro"><strong>Commercial information</strong><span>Pricing and carton quantities used for sales and catalogue output.</span></div></div>
            <div className="field"><label>MRP (₹)</label><input type="number" min="0" step="0.01" value={form.mrp} onChange={e=>set('mrp',e.target.value)} placeholder="e.g. 599" /></div>
            <div className="field"><label>Selling Price (₹)</label><input type="number" min="0" step="0.01" value={form.sp} onChange={e=>set('sp',e.target.value)} placeholder="e.g. 249" /></div>
            <div className="field"><label>Master Carton Qty</label><input type="number" min="0" step="1" value={form.master_qty} onChange={e=>set('master_qty',e.target.value)} placeholder="e.g. 96" /></div>
            <div className="field"><label>Inner Carton Qty</label><input type="number" min="0" step="1" value={form.inner_qty} onChange={e=>set('inner_qty',e.target.value)} placeholder="e.g. 12" /></div>
            <div className="field full"><div className="commercial-preview"><div><small>Discount</small><strong>{form.mrp&&form.sp?`${Math.max(0,Math.round((1-(Number(form.sp)/Number(form.mrp)))*100))}%`: '—'}</strong></div><div><small>Article No.</small><strong>{form.article_no||'Not assigned'}</strong></div><div><small>EAN</small><strong>{form.ean||'—'}</strong></div></div></div>
          </div>}

          {editTab==='logistics' && <div className="form-grid editor-section">
            <div className="field full"><div className="section-intro"><strong>Logistics & packaging</strong><span>Dimensions and weights are grouped by SKU, master carton and inner carton.</span></div></div>
            <DimGroup title="SKU (unit) dimensions &amp; weight" prefix="sku" form={form} set={set} dimUnits={['CM','MM','M']} />
            <DimGroup title="Master carton dimensions &amp; weight" prefix="master" form={form} set={set} dimUnits={['CM','MM']} />
            <DimGroup title="Inner carton dimensions &amp; weight" prefix="inner" form={form} set={set} dimUnits={['CM','MM']} />
          </div>}

          {editTab==='media' && <div className="editor-media-section">
            <div className="section-intro"><strong>Product image</strong><span>Use a clean front-facing image. JPG or PNG is recommended.</span></div>
            <div className={`img-drop editor-drop${dragActive?' img-drop-active':''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
              <div className="preview large-preview">{imagePreview?<img src={imagePreview} alt=""/>:<span>NO IMAGE</span>}</div>
              <div className="media-actions"><label className="btn btn-teal">Choose Image<input type="file" accept="image/*" hidden onChange={handleImageChange}/></label><p className="hint">Drag a local image here or choose a file. It will be uploaded to Supabase Storage when you save.</p></div>
            </div>
            {imagePreview&&<div className="image-meta"><span>Preview ready</span><span>{imageFile?imageFile.name:'Existing image'}</span></div>}
          </div>}

          </fieldset>
          <div className="form-footer editor-footer"><button type="button" className="btn" onClick={onCancel}>Cancel</button><div className="editor-footer-right">{editTab!=='core'&&<button type="button" className="btn" onClick={()=>setEditTab(editTab==='commercial'?'core':editTab==='logistics'?'commercial':'logistics')}>← Previous</button>}{editTab!=='media'&&<button type="button" className="btn btn-teal" onClick={()=>setEditTab(editTab==='core'?'commercial':editTab==='commercial'?'logistics':'media')}>Next →</button>}{!readOnly && <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':form.id?'Save Changes':'Add Article'}</button>}</div></div>
        </form>
      </div>

      {!readOnly && !form.id && <div className="form-card bulk-upload-card"><h2>Bulk Upload</h2><div className="sub">Add many articles at once from a CSV file. Invalid or duplicate EAN rows are skipped and listed below.</div><div className="controls-row" style={{marginBottom:6}}><label className="btn btn-primary" style={{cursor:'pointer'}}>⬆ Upload CSV<input type="file" accept=".csv" style={{display:'none'}} onChange={handleBulkFile}/></label><button type="button" className="btn" onClick={downloadBulkTemplate}>⬇ Download CSV template</button></div>{bulkProgress&&<div style={{marginTop:14}}><div className="bulk-progress-label"><span>Uploading…</span><span>{bulkProgress.current} / {bulkProgress.total}</span></div><div className="bar-track" style={{height:10}}><div className="bar-fill" style={{width:`${bulkProgress.total?Math.round((bulkProgress.current/bulkProgress.total)*100):0}%`}}/></div></div>}{bulkResult.length>0&&<div style={{fontFamily:"'Inter',sans-serif",fontSize:12,marginTop:12}}><div style={{fontWeight:600}}>{bulkResult.filter(r=>r.ok).length} added · {bulkResult.filter(r=>!r.ok).length} skipped</div>{bulkResult.map((r,i)=><div key={i} className={`bulk-row ${r.ok?'ok':'skip'}`}><span>{r.label}</span><span>{r.msg}</span></div>)}</div>}</div>}
    </div>
  );

}
function DimGroup({ title, prefix, form, set, dimUnits }) {
  const L = `${prefix}_l`, W = `${prefix}_w`, H = `${prefix}_h`, DU = `${prefix}_dim_unit`;
  const NW = `${prefix}_nw`, GW = `${prefix}_gw`, WU = `${prefix}_wt_unit`;
  return (
    <>
      <div className="field full section-label" dangerouslySetInnerHTML={{ __html: title }} />
      <div className="field full">
        <div className="inline-grid dims4">
          <div className="field"><label>Length</label><input type="number" min="0" step="0.01" value={form[L]} onChange={(e) => set(L, e.target.value)} /></div>
          <div className="field"><label>Width</label><input type="number" min="0" step="0.01" value={form[W]} onChange={(e) => set(W, e.target.value)} /></div>
          <div className="field"><label>Height</label><input type="number" min="0" step="0.01" value={form[H]} onChange={(e) => set(H, e.target.value)} /></div>
          <div className="field">
            <label>Dim Unit</label>
            <select value={form[DU]} onChange={(e) => set(DU, e.target.value)}>
              {dimUnits.map(u => <option key={u} value={u}>{u === 'M' ? 'Meter' : u}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="field full">
        <div className="inline-grid wts3">
          <div className="field"><label>Net Weight</label><input type="number" min="0" step="0.001" value={form[NW]} onChange={(e) => set(NW, e.target.value)} /></div>
          <div className="field"><label>Gross Weight</label><input type="number" min="0" step="0.001" value={form[GW]} onChange={(e) => set(GW, e.target.value)} /></div>
          <div className="field">
            <label>Weight Unit</label>
            <select value={form[WU]} onChange={(e) => set(WU, e.target.value)}>
              <option value="KG">KG</option><option value="G">G</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}
