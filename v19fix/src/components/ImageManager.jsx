import React, { useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useToast } from './Toast.jsx';

export default function ImageManager({ products, isAuthed, onUpdated, onOpenProduct }) {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);

  const missing = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(p => !p.image_url && (!q || [p.description, p.model, p.ean, p.article_no, p.brand].filter(Boolean).join(' ').toLowerCase().includes(q))).slice(0, 40);
  }, [products, query]);

  async function upload(product, file) {
    if (!isAuthed || !file || !file.type.startsWith('image/')) return;
    setBusyId(product.id);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const filename = `catalog-${product.ean || product.id}-${Date.now()}.${ext}`.replace(/[^a-z0-9._-]/gi, '_');
      const { error: upErr } = await supabase.storage.from('product-images').upload(filename, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('product-images').getPublicUrl(filename);
      const { error } = await supabase.from('products').update({ image_url: data.publicUrl }).eq('id', product.id);
      if (error) throw error;
      showToast(`Image added to ${product.description || product.ean}`);
      onUpdated?.();
    } catch (err) {
      showToast(err.message || 'Could not upload image', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="panel image-manager-panel">
      <div className="panel-heading-row">
        <div>
          <h3>Image Management</h3>
          <div className="panel-hint">Find articles without images and upload them directly.</div>
        </div>
        <span className="quality-badge danger">{missing.length}{missing.length === 40 ? '+' : ''} shown</span>
      </div>
      <div className="smart-search image-manager-search">
        <span>⌕</span><input aria-label="Search missing images" placeholder="Search missing-image articles…" value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      {!isAuthed && <div className="inline-notice">Sign in to upload images. You can still browse missing-image records.</div>}
      {missing.length === 0 ? <div className="quality-empty">🎉 All matching articles have images.</div> : (
        <div className="image-manager-list">
          {missing.map(p => (
            <div className="image-manager-row" key={p.id}>
              <div className="missing-thumb">IMG</div>
              <div className="image-manager-info" onClick={() => onOpenProduct?.(p)}>
                <strong>{p.description || p.model || 'Unnamed article'}</strong>
                <span>{p.brand || '—'} · {p.ean || 'No EAN'} · {p.article_no || 'No Article No.'}</span>
              </div>
              <label className="btn btn-teal compact-upload" title={isAuthed ? 'Upload image' : 'Sign in to upload'}>
                {busyId === p.id ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/*" disabled={!isAuthed || busyId === p.id} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; upload(p, f); }} />
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
