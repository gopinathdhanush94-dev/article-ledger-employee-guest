import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../lib/useAuth.js';

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function qty(value) {
  return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

function normalizeEan(value) {
  return String(value ?? '').trim();
}

async function fetchArticleEans() {
  const pageSize = 1000;
  let all = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase.from('products').select('ean').range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat((data || []).map(row => normalizeEan(row.ean)).filter(Boolean));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return new Set(all);
}

export default function SapStock({ onClose }) {
  const { isEmployee, permissions } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadStock = async () => {
    setRefreshing(true);
    setError('');
    try {
      // Article Ledger is the source of truth for which articles are allowed to appear here.
      const articleEans = await fetchArticleEans();
      const { data, error: queryError } = await supabase
        .from('article_stock')
        .select('ean,sap_material_code,item_name,warehouse_name,location_name,quantity,stock_value,last_synced_at')
        .order('item_name', { ascending: true });
      if (queryError) throw queryError;
      setRows((data || []).filter(row => articleEans.has(normalizeEan(row.ean))));
    } catch (queryError) {
      setError(queryError?.message || 'Unable to load SAP stock');
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isEmployee && permissions?.canViewStock) void loadStock();
  }, [isEmployee, permissions?.canViewStock]);

  const locations = useMemo(() => {
    const set = new Set();
    rows.forEach((row) => set.add(row.location_name || 'Unspecified'));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const visibleLocations = locationFilter ? [locationFilter] : locations;

  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const ean = normalizeEan(row.ean);
      const key = [ean, row.sap_material_code || '', row.item_name || ''].join('|');
      if (!map.has(key)) map.set(key, { ean, sap_material_code: row.sap_material_code || '', item_name: row.item_name || '', locations: new Map() });
      const item = map.get(key);
      const location = row.location_name || 'Unspecified';
      const previous = item.locations.get(location) || { quantity: 0, stockValue: 0 };
      item.locations.set(location, {
        quantity: previous.quantity + Number(row.quantity || 0),
        stockValue: previous.stockValue + Number(row.stock_value || 0),
      });
    });
    return [...map.values()];
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return grouped.filter((item) => {
      const matchesSearch = !term || [item.ean, item.sap_material_code, item.item_name].some((value) => String(value).toLowerCase().includes(term));
      const matchesLocation = !locationFilter || item.locations.has(locationFilter);
      return matchesSearch && matchesLocation;
    });
  }, [grouped, search, locationFilter]);

  const totals = useMemo(() => filtered.reduce((acc, item) => {
    visibleLocations.forEach((location) => {
      const locationData = item.locations.get(location);
      if (!locationData) return;
      acc.quantity += locationData.quantity;
      acc.value += locationData.stockValue;
    });
    return acc;
  }, { quantity: 0, value: 0 }), [filtered, visibleLocations]);

  const lastSynced = useMemo(() => {
    const dates = rows.map((r) => r.last_synced_at).filter(Boolean).map((v) => new Date(v).getTime()).filter(Number.isFinite);
    if (!dates.length) return null;
    return new Date(Math.max(...dates));
  }, [rows]);

  if (!isEmployee || !permissions?.canViewStock) return null;

  return (
    <div className="sap-stock-screen">
      <div className="sap-stock-header">
        <div>
          <div className="sap-stock-eyebrow">ERP STOCK</div>
          <div className="sap-stock-title-row">
            <div><h2>SAP Stock</h2><p>Stock availability mapped only to articles already present in Article Ledger.</p></div>
            <span className="sap-stock-scope-badge">ARTICLE LEDGER EANs ONLY</span>
          </div>
        </div>
        <div className="sap-stock-actions">
          <div className="sap-stock-sync"><span className="sap-stock-sync-dot" />{lastSynced ? `Updated ${lastSynced.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Snapshot loaded'}</div>
          <button className="btn btn-secondary" onClick={() => void loadStock()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh Stock'}</button>
          {onClose && <button className="btn btn-primary" onClick={onClose}>Back</button>}
        </div>
      </div>

      <section className="sap-stock-metrics">
        <div className="sap-stock-metric"><span className="sap-stock-metric-label">Mapped Articles</span><strong>{filtered.length.toLocaleString('en-IN')}</strong><small>Matching Article Ledger EANs</small></div>
        <div className="sap-stock-metric"><span className="sap-stock-metric-label">Total Quantity</span><strong>{qty(totals.quantity)}</strong><small>{locationFilter ? `Visible in ${locationFilter}` : 'Across all locations'}</small></div>
        <div className="sap-stock-metric"><span className="sap-stock-metric-label">Locations</span><strong>{locations.length}</strong><small>Detected in SAP snapshot</small></div>
        <div className="sap-stock-metric sap-stock-metric-value"><span className="sap-stock-metric-label">Stock Value</span><strong>{money(totals.value)}</strong><small>Value of visible stock</small></div>
      </section>

      <section className="sap-stock-panel">
        <div className="sap-stock-panel-head"><div><h3>Stock by Location</h3><p>Each row represents one Article Ledger EAN and SAP material combination.</p></div><div className="sap-stock-result-count"><strong>{filtered.length.toLocaleString('en-IN')}</strong> mapped records</div></div>
        <div className="sap-stock-toolbar">
          <label className="sap-stock-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search EAN, SAP material or item name…" aria-label="Search SAP stock" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button>}</label>
          <label className="sap-stock-location-filter"><span>Location</span><select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}><option value="">All locations</option>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</select></label>
        </div>
        <div className="sap-stock-table-note"><span className="sap-stock-check">✓</span>Showing SAP records only when the EAN exists in the Article Ledger.{locationFilter && <button type="button" onClick={() => setLocationFilter('')}>Clear location filter</button>}</div>

        {loading ? (
          <div className="sap-stock-empty"><strong>Loading SAP stock…</strong><span>Preparing the mapped stock view.</span></div>
        ) : error ? (
          <div className="sap-stock-empty sap-stock-empty-error"><strong>Could not load SAP stock</strong><span>{error}</span><button className="btn btn-secondary" onClick={() => void loadStock()}>Try again</button></div>
        ) : !filtered.length ? (
          <div className="sap-stock-empty"><strong>No mapped stock records found</strong><span>Try another search or location, or confirm that the SAP EAN exists in Article Ledger.</span></div>
        ) : (
          <div className="sap-stock-table-wrap">
            <table className="sap-stock-table">
              <thead><tr><th className="sap-col-ean">EAN</th><th className="sap-col-material">SAP Material</th><th className="sap-col-item">Item Name</th>{visibleLocations.map((location) => <th key={location} className="sap-col-location" title={location}>{location}</th>)}<th className="sap-col-total">Total Qty</th><th className="sap-col-value">Stock Value</th></tr></thead>
              <tbody>
                {filtered.map((item) => {
                  const totalQty = visibleLocations.reduce((sum, location) => sum + (item.locations.get(location)?.quantity || 0), 0);
                  const totalValue = visibleLocations.reduce((sum, location) => sum + (item.locations.get(location)?.stockValue || 0), 0);
                  return <tr key={[item.ean, item.sap_material_code, item.item_name].join('|')}>
                    <td className="sap-col-ean sap-ean-cell"><span>{item.ean || '—'}</span></td>
                    <td className="sap-col-material"><strong>{item.sap_material_code || '—'}</strong></td>
                    <td className="sap-col-item" title={item.item_name || ''}>{item.item_name || '—'}</td>
                    {visibleLocations.map((location) => { const locationData = item.locations.get(location); return <td key={location} className="sap-col-location sap-number-cell">{locationData ? qty(locationData.quantity) : <span className="sap-dash">—</span>}</td>; })}
                    <td className="sap-col-total sap-number-cell"><strong>{qty(totalQty)}</strong></td>
                    <td className="sap-col-value sap-number-cell"><strong>{money(totalValue)}</strong></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
