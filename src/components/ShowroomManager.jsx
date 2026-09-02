import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';

function imageFor(item) {
  return item?.image_url || '';
}

function nameFor(item) {
  return item?.name || item?.model || item?.article_no || 'Untitled product';
}

export default function ShowroomManager({ canEdit = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [visibility, setVisibility] = useState('all');
  const [category, setCategory] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const pageSize = 1000;
    const all = [];
    let from = 0;
    try {
      while (true) {
        const { data, error: err } = await supabase
          .from('showroom_items')
          .select('id,source_type,source_id,ean,article_no,name,brand,model,category,description,image_url,features,dimensions,featured,visible,created_at,updated_at')
          .order('featured', { ascending: false })
          .order('visible', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (err) throw err;
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      setItems(all);
    } catch (err) {
      setError(err?.message || 'Unable to load showroom items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => Array.from(new Set(items.map(item => String(item.category || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [items]);

  const stats = useMemo(() => ({
    total: items.length,
    visible: items.filter(x => x.visible).length,
    hidden: items.filter(x => !x.visible).length,
    featured: items.filter(x => x.featured && x.visible).length,
  }), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(item => {
      if (type !== 'all' && item.source_type !== type) return false;
      if (visibility === 'visible' && !item.visible) return false;
      if (visibility === 'hidden' && item.visible) return false;
      if (category !== 'all' && String(item.category || '') !== category) return false;
      if (!q) return true;
      return [item.name, item.brand, item.model, item.category, item.ean, item.article_no]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    });
  }, [items, search, type, visibility]);

  async function updateItem(id, patch) {
    if (!canEdit) return;
    setBusyId(id);
    const { data, error: err } = await supabase
      .from('showroom_items')
      .update(patch)
      .eq('id', id)
      .select('id,featured,visible,updated_at')
      .single();
    if (err) {
      setError(err.message || 'Could not update showroom item');
    } else {
      setItems(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    }
    setBusyId(null);
  }

  async function setAllVisible(nextVisible) {
    if (!canEdit || !filtered.length) return;
    setBulkBusy(true);
    setError('');
    const ids = filtered.map(item => item.id);
    const { error: err } = await supabase
      .from('showroom_items')
      .update({ visible: nextVisible, ...(nextVisible ? {} : { featured: false }) })
      .in('id', ids);
    if (err) setError(err.message || 'Could not update showroom items');
    else setItems(prev => prev.map(item => ids.includes(item.id) ? { ...item, visible: nextVisible, ...(nextVisible ? {} : { featured: false }) } : item));
    setBulkBusy(false);
  }

  async function setAllFeatured(nextFeatured) {
    if (!canEdit || !filtered.length) return;
    setBulkBusy(true);
    setError('');
    const ids = filtered.filter(item => nextFeatured ? item.visible : true).map(item => item.id);
    if (!ids.length) { setBulkBusy(false); return; }
    const { error: err } = await supabase
      .from('showroom_items')
      .update({ featured: nextFeatured })
      .in('id', ids);
    if (err) setError(err.message || 'Could not update featured items');
    else setItems(prev => prev.map(item => ids.includes(item.id) ? { ...item, featured: nextFeatured } : item));
    setBulkBusy(false);
  }

  return (
    <main className="showroom-manager">
      <section className="showroom-manager-hero">
        <div>
          <span className="showroom-manager-eyebrow">SHOWROOM CONTROL</span>
          <h1>Manage showroom</h1>
          <p>All showroom items are visible to guests by default. Use category filters to quickly show, hide or feature groups of products.</p>
        </div>
        <button type="button" className="showroom-manager-refresh" onClick={load} disabled={loading}>↻ Refresh</button>
      </section>

      <section className="showroom-manager-stats">
        <div><strong>{stats.total}</strong><span>Total showroom items</span></div>
        <div><strong>{stats.visible}</strong><span>Visible to guests</span></div>
        <div><strong>{stats.hidden}</strong><span>Hidden</span></div>
        <div><strong>{stats.featured}</strong><span>Featured</span></div>
      </section>

      <section className="showroom-manager-panel">
        <div className="showroom-manager-toolbar">
          <label className="showroom-manager-search">
            <span>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, article no., EAN, brand…" />
          </label>
          <div className="showroom-manager-filters">
            {[
              ['all', 'All'],
              ['product', 'Products'],
              ['garment', 'Garments'],
            ].map(([value, label]) => <button key={value} type="button" className={type === value ? 'active' : ''} onClick={() => setType(value)}>{label}</button>)}
            <select value={visibility} onChange={e => setVisibility(e.target.value)} aria-label="Visibility filter">
              <option value="all">All visibility</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
            <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category filter">
              <option value="all">All categories</option>
              {categories.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>

        <div className="showroom-manager-actions">
          <span>{filtered.length} matching items{category !== 'all' ? ` · ${category}` : ''}</span>
          {canEdit && <div className="showroom-manager-bulk-actions">
            <button type="button" onClick={() => setAllVisible(true)} disabled={bulkBusy || !filtered.length}>Show all matching</button>
            <button type="button" onClick={() => setAllVisible(false)} disabled={bulkBusy || !filtered.length}>Hide all matching</button>
            <button type="button" onClick={() => setAllFeatured(true)} disabled={bulkBusy || !filtered.some(item => item.visible)}>Feature all matching</button>
            <button type="button" onClick={() => setAllFeatured(false)} disabled={bulkBusy || !filtered.length}>Unfeature all matching</button>
          </div>}
        </div>

        {error && <div className="showroom-manager-error">{error}<button type="button" onClick={load}>Retry</button></div>}

        {loading ? <div className="showroom-manager-empty">Loading showroom items…</div> : !filtered.length ? (
          <div className="showroom-manager-empty"><strong>No matching showroom items</strong><span>Try a different search or filter.</span></div>
        ) : (
          <div className="showroom-manager-table-wrap">
            <table className="showroom-manager-table">
              <thead>
                <tr>
                  <th>Product</th><th>Type</th><th>Article / EAN</th><th>Category</th><th>Guest visibility</th><th>Featured</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="showroom-manager-product">
                        {imageFor(item) ? <img src={imageFor(item)} alt="" loading="lazy" /> : <div className="showroom-manager-thumb">{String(item.category || item.source_type || 'P').slice(0, 1).toUpperCase()}</div>}
                        <div><strong>{nameFor(item)}</strong><span>{[item.brand, item.model].filter(Boolean).join(' · ') || '—'}</span></div>
                      </div>
                    </td>
                    <td><span className="showroom-manager-type">{item.source_type}</span></td>
                    <td><div className="showroom-manager-code">{item.article_no || '—'}<small>{item.ean || 'No EAN'}</small></div></td>
                    <td>{item.category || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className={`showroom-toggle ${item.visible ? 'on' : ''}`}
                        disabled={!canEdit || busyId === item.id}
                        onClick={() => updateItem(item.id, { visible: !item.visible, ...(item.visible ? { featured: false } : {}) })}
                        aria-label={`${item.visible ? 'Hide' : 'Publish'} ${nameFor(item)}`}
                      >
                        <span /> {item.visible ? 'Visible' : 'Hidden'}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`showroom-star ${item.featured ? 'on' : ''}`}
                        disabled={!canEdit || !item.visible || busyId === item.id}
                        onClick={() => updateItem(item.id, { featured: !item.featured })}
                      >★ {item.featured ? 'Featured' : 'Feature'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
