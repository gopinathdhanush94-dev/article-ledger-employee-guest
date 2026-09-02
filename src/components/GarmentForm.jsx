import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { uniqueSorted } from '../lib/helpers.js';
import Autocomplete from './Autocomplete.jsx';
import { useDialogs } from './Dialogs.jsx';

const BLANK_STYLE = {
  excel_name: '', model_name: '', model1: '', brand: '', description: '', color: '',
  customer_model: '', origin: '', moi: '', mfd: '', sheet: '', source_file: '',
  master_ean: '', master_article: '',
};
const BLANK_SIZE_ROW = () => ({ _key: Math.random().toString(36).slice(2), size: '', ratio: '', ean: '', article: '', mrp: '', rrp: '' });

export default function GarmentForm({ garments, editingGroup, onSaved, onCancel, readOnly = false }) {
  const dialogs = useDialogs();
  const [style, setStyle] = useState(BLANK_STYLE);
  const [sizeRows, setSizeRows] = useState([BLANK_SIZE_ROW()]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingGroup) {
      setStyle({
        excel_name: editingGroup.excel_name || '', model_name: editingGroup.model_name || '',
        model1: editingGroup.model1 || '', brand: editingGroup.brand || '',
        description: editingGroup.description || '', color: editingGroup.color || '',
        customer_model: editingGroup.customer_model || '', origin: editingGroup.origin || '',
        moi: editingGroup.moi || '', mfd: editingGroup.mfd || '',
        sheet: editingGroup.sizes[0]?.sheet || '', source_file: editingGroup.source_file || '',
        master_ean: editingGroup.master_ean || '', master_article: editingGroup.master_article || '',
      });
      setSizeRows(editingGroup.sizes.map(s => ({
        _key: s.id, id: s.id, size: s.size || '', ratio: s.ratio ?? '', ean: s.ean || '',
        article: s.article || '', mrp: s.mrp ?? '', rrp: s.rrp ?? '',
      })));
      setImagePreview(editingGroup.image_url || null);
    } else {
      setStyle(BLANK_STYLE);
      setSizeRows([BLANK_SIZE_ROW()]);
      setImagePreview(null);
    }
    setImageFile(null);
  }, [editingGroup]);

  const brands = uniqueSorted(garments, 'brand');
  const modelNames = uniqueSorted(garments, 'model_name');
  const colors = uniqueSorted(garments, 'color');

  function setStyleField(field, val) { setStyle(s => ({ ...s, [field]: val })); }
  function setSizeField(key, field, val) {
    setSizeRows(rows => rows.map(r => (r._key === key ? { ...r, [field]: val } : r)));
  }
  function addSizeRow() { setSizeRows(rows => [...rows, BLANK_SIZE_ROW()]); }
  function removeSizeRow(key) { setSizeRows(rows => rows.length > 1 ? rows.filter(r => r._key !== key) : rows); }

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

  function handleDragOver(e) { e.preventDefault(); setDragActive(true); }
  function handleDragLeave(e) { e.preventDefault(); setDragActive(false); }

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
      const file2 = new File([blob], filename, { type: blob.type });
      setImageFromFile(file2);
    } catch (err) {
      dialogs.alertDialog({
        title: 'Could not use that image',
        message: 'That website blocks other sites from copying its images directly. Save the image to your computer first (right-click → Save Image As), then drag the saved file in instead.',
      });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!style.brand.trim() || !style.excel_name.trim()) {
      dialogs.alertDialog({ title: 'Missing info', message: 'Style name and brand are required.' });
      return;
    }
    const validSizeRows = sizeRows.filter(r => r.size.trim() !== '');
    if (validSizeRows.length === 0) {
      dialogs.alertDialog({ title: 'Missing sizes', message: 'Add at least one size row.' });
      return;
    }

    dialogs.confirmDialog({
      title: editingGroup ? 'Save changes to this garment style?' : 'Add this garment style?',
      message: editingGroup
        ? 'This will replace the size list for this style with what you\'ve entered in the form.'
        : `Double-check the form — ${validSizeRows.length} size${validSizeRows.length === 1 ? '' : 's'} will be saved right away once confirmed.`,
      confirmLabel: editingGroup ? 'Save Changes' : 'Add Garment Style',
      onConfirm: () => performSave(validSizeRows),
    });
  }

  async function performSave(validSizeRows) {
    setSaving(true);
    try {
      let imageUrl = editingGroup?.image_url || null;
      if (imageFile) {
        const filename = `${Date.now()}-${imageFile.name.replace(/[^a-z0-9.]/gi, '_')}`;
        const { error: upErr } = await supabase.storage.from('garment-images').upload(filename, imageFile, { upsert: true });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('garment-images').getPublicUrl(filename);
        imageUrl = data.publicUrl;
      }

      const baseRow = {
        excel_name: style.excel_name.trim(),
        model_name: style.model_name.trim() || null,
        model1: style.model1.trim() || null,
        brand: style.brand.trim(),
        description: style.description.trim() || null,
        color: style.color.trim() || null,
        customer_model: style.customer_model.trim() || null,
        origin: style.origin.trim() || null,
        moi: style.moi.trim() || null,
        mfd: style.mfd.trim() || null,
        sheet: style.sheet.trim().toUpperCase() || null,
        source_file: style.source_file.trim() || 'CUSTOM',
        master_ean: style.master_ean.trim() || null,
        master_article: style.master_article.trim() || null,
        image_url: imageUrl,
        custom: true,
      };

      const rowsToInsert = validSizeRows.map(r => ({
        ...baseRow,
        size: r.size.trim(),
        ratio: r.ratio === '' ? null : Number(r.ratio),
        ean: r.ean.trim() || null,
        article: r.article.trim() || null,
        mrp: r.mrp === '' ? null : Number(r.mrp),
        rrp: r.rrp === '' ? null : Number(r.rrp),
      }));

      if (editingGroup) {
        // Replace strategy: remove the old size rows for this group, insert the edited set.
        const oldIds = editingGroup.sizes.map(s => s.id);
        const { error: delErr } = await supabase.from('garments').delete().in('id', oldIds);
        if (delErr) throw delErr;
      }

      const { error: insErr } = await supabase.from('garments').insert(rowsToInsert);
      if (insErr) throw insErr;

      onSaved(!!editingGroup, style.excel_name.trim());
    } catch (err) {
      dialogs.alertDialog({ title: 'Could not save garment', message: err.message || String(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="form-wrap">
      <div className="form-card">
        <h2>{editingGroup ? 'Edit Garment Style' : 'Add a New Garment Style'}</h2>
        <div className="sub">
          {editingGroup
            ? 'Saving replaces the full size list for this style + color with what you enter below.'
            : 'One photo and one set of details cover the whole style + color — add a row for every size it comes in.'}
        </div>

        <form onSubmit={handleSubmit}>
          {readOnly && <div className="um-readonly-banner">View only — your role can open Add Product, but cannot create or edit garment records.</div>}
          <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-grid">
            <div className="field full">
              <label>Style Photo</label>
              <div
                className={`img-drop${dragActive ? ' img-drop-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="preview">
                  {imagePreview ? <img src={imagePreview} alt="" /> : <span style={{ fontSize: 9, fontFamily: "'Inter',sans-serif", color: '#A79E85' }}>NO IMAGE</span>}
                </div>
                <div>
                  <input type="file" accept="image/*" onChange={handleImageChange} />
                  <div className="hint">One photo represents this style + color across all its sizes. Drag a file from your computer, or drag an image straight from a website.</div>
                </div>
              </div>
            </div>

            <div className="field">
              <label>Style Name <span className="req">*</span></label>
              <input type="text" required value={style.excel_name} onChange={(e) => setStyleField('excel_name', e.target.value)} placeholder="e.g. Puffer Jacket Girls" />
            </div>
            <div className="field">
              <label>Brand <span className="req">*</span></label>
              <Autocomplete value={style.brand} onChange={(v) => setStyleField('brand', v)} options={brands} required placeholder="e.g. LIVESMEART" />
            </div>
            <div className="field">
              <label>Garment Type</label>
              <Autocomplete value={style.model_name} onChange={(v) => setStyleField('model_name', v)} options={modelNames} placeholder="e.g. JACKET" />
            </div>
            <div className="field">
              <label>Color</label>
              <Autocomplete value={style.color} onChange={(v) => setStyleField('color', v)} options={colors} placeholder="e.g. PINK" />
            </div>
            <div className="field">
              <label>Internal Model (Model1)</label>
              <input type="text" value={style.model1} onChange={(e) => setStyleField('model1', e.target.value)} placeholder="e.g. FM22790 K" />
            </div>
            <div className="field">
              <label>Customer Model</label>
              <input type="text" value={style.customer_model} onChange={(e) => setStyleField('customer_model', e.target.value)} placeholder="e.g. BKGJACKCGI5050" />
            </div>
            <div className="field">
              <label>Description / Fabric</label>
              <input type="text" value={style.description} onChange={(e) => setStyleField('description', e.target.value)} placeholder="e.g. 100% Polyester" />
            </div>
            <div className="field">
              <label>Origin</label>
              <input type="text" value={style.origin} onChange={(e) => setStyleField('origin', e.target.value)} placeholder="e.g. CHINA" />
            </div>
            <div className="field">
              <label>MOI (Month of Import)</label>
              <input type="text" value={style.moi} onChange={(e) => setStyleField('moi', e.target.value)} placeholder="e.g. JUN" />
            </div>
            <div className="field">
              <label>MFD</label>
              <input type="text" value={style.mfd} onChange={(e) => setStyleField('mfd', e.target.value)} placeholder="e.g. JUL" />
            </div>
            <div className="field">
              <label>Month / Batch (Sheet)</label>
              <input type="text" value={style.sheet} onChange={(e) => setStyleField('sheet', e.target.value)} placeholder="e.g. JAN" />
            </div>
            <div className="field">
              <label>Collection / Source</label>
              <input type="text" value={style.source_file} onChange={(e) => setStyleField('source_file', e.target.value)} placeholder="e.g. 2026_LIVESMEART" />
            </div>
            <div className="field">
              <label>Master EAN</label>
              <input type="text" value={style.master_ean} onChange={(e) => setStyleField('master_ean', e.target.value)} placeholder="Optional" />
            </div>
            <div className="field">
              <label>Master Article</label>
              <input type="text" value={style.master_article} onChange={(e) => setStyleField('master_article', e.target.value)} placeholder="Optional" />
            </div>

            <div className="field full section-label">Size run</div>
            <div className="field full">
              {sizeRows.map((r) => (
                <div key={r._key} className="inline-grid" style={{ gridTemplateColumns: '1fr 0.8fr 1.3fr 1.3fr 0.9fr 0.9fr auto', marginBottom: 10, alignItems: 'end' }}>
                  <div className="field"><label>Size</label><input type="text" value={r.size} onChange={(e) => setSizeField(r._key, 'size', e.target.value)} placeholder="e.g. 2-3Y" /></div>
                  <div className="field"><label>Set Qty</label><input type="number" min="0" step="1" value={r.ratio} onChange={(e) => setSizeField(r._key, 'ratio', e.target.value)} placeholder="1" /></div>
                  <div className="field"><label>EAN</label><input type="text" value={r.ean} onChange={(e) => setSizeField(r._key, 'ean', e.target.value)} placeholder="EAN code" /></div>
                  <div className="field"><label>Article</label><input type="text" value={r.article} onChange={(e) => setSizeField(r._key, 'article', e.target.value)} placeholder="Article no." /></div>
                  <div className="field"><label>MRP</label><input type="number" min="0" step="0.01" value={r.mrp} onChange={(e) => setSizeField(r._key, 'mrp', e.target.value)} /></div>
                  <div className="field"><label>RRP</label><input type="number" min="0" step="0.01" value={r.rrp} onChange={(e) => setSizeField(r._key, 'rrp', e.target.value)} /></div>
                  <button type="button" className="add-new-btn" onClick={() => removeSizeRow(r._key)} title="Remove this size">✕</button>
                </div>
              ))}
              <button type="button" className="btn" onClick={addSizeRow}>+ Add another size</button>
            </div>
          </div>
          </fieldset>
          <div className="form-footer">
            <button type="button" className="btn" onClick={onCancel}>Cancel</button>
            {!readOnly && <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingGroup ? 'Save Changes' : 'Add Garment Style'}
            </button>}
          </div>
        </form>
      </div>
    </div>
  );
}
