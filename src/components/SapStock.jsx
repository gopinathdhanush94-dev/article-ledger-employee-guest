import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../lib/useAuth.js';

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function qty(value) {
  return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

export default function SapStock({ onClose }) {
  const { isEmployee, permissions } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadStock = async () => {
    setRefreshing(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('article_stock')
      .select('ean,sap_material_code,item_name,warehouse_name,location_name,quantity,stock_value,last_synced_at')
      .order('item_name', { ascending: true });
    if (queryError) {
      setError(queryError.message || 'Unable to load SAP stock');
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { if (isEmployee && permissions?.canViewStock) void loadStock(); }, [isEmployee, permissions?.canViewStock]);

  const locations = useMemo(() => {
    const set = new Set();
    rows.forEach((row) => set.add(row.location_name || 'Unspecified'));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = [row.ean || '', row.sap_material_code || '', row.item_name || ''].join('|');
      if (!map.has(key)) {
        map.set(key, {
          ean: row.ean || '',
          sap_material_code: row.sap_material_code || '',
          item_name: row.item_name || '',
          locations: new Map(),
        });
      }
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
    if (!term) return grouped;
    return grouped.filter((item) => [item.ean, item.sap_material_code, item.item_name].some((v) => String(v).toLowerCase().includes(term)));
  }, [grouped, search]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.quantity += Number(row.quantity || 0);
    acc.value += Number(row.stock_value || 0);
    return acc;
  }, { quantity: 0, value: 0 }), [rows]);

  const lastSynced = useMemo(() => {
    const dates = rows.map((r) => r.last_synced_at).filter(Boolean).map((v) => new Date(v).getTime()).filter(Number.isFinite);
    if (!dates.length) return null;
    return new Date(Math.max(...dates));
  }, [rows]);

  if (!isEmployee || !permissions?.canViewStock) return null;

  return (
    <div className="sap-stock-screen">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">ERP STOCK</span>
          <h2>SAP Stock</h2>
          <p>Live stock records mapped to Article Ledger by EAN and SAP material.</p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-secondary" onClick={() => void loadStock()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh Stock'}</button>
          {onClose && <button className="btn btn-primary" onClick={onClose}>Back</button>}
        </div>
      </div>

      <section className="dashboard-metrics compact">
        <div className="metric-card"><strong>{filtered.length}</strong><span>Articles</span></div>
        <div className="metric-card"><strong>{qty(totals.quantity)}</strong><span>Total Quantity</span></div>
        <div className="metric-card"><strong>{locations.length}</strong><span>Locations</span></div>
        <div className="metric-card"><strong>{money(totals.value)}</strong><span>Stock Value</span></div>
      </section>

      <div className="panel glass-panel">
        <div className="panel-heading-row">
          <div>
            <h3>Stock by Location</h3>
            <div className="panel-hint">Locations are created dynamically from the SAP data.</div>
          </div>
          {lastSynced && <div className="panel-hint">Last synced: {lastSynced.toLocaleString('en-IN')}</div>}
        </div>
        <div className="smart-search">
          <span>⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search EAN, SAP material or item name…" />
        </div>

        {loading ? <div className="home-data-status">Loading SAP stock…</div> : error ? <div className="home-data-status">{error}</div> : !filtered.length ? <div className="home-data-status">No SAP stock records found.</div> : (
          <div className="overflow-x-auto">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>EAN</th>
                  <th>SAP Material</th>
                  <th>Item Name</th>
                  {locations.map((location) => <th key={location} className="stock-number">{location}</th>)}
                  <th className="stock-number">Total Qty</th>
                  <th className="stock-number">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const totalQty = locations.reduce((sum, location) => sum + (item.locations.get(location)?.quantity || 0), 0);
                  const totalValue = locations.reduce((sum, location) => sum + (item.locations.get(location)?.stockValue || 0), 0);
                  return (
                    <tr key={[item.ean, item.sap_material_code, item.item_name].join('|')}>
                      <td>{item.ean || '—'}</td>
                      <td><strong>{item.sap_material_code || '—'}</strong></td>
                      <td>{item.item_name || '—'}</td>
                      {locations.map((location) => <td key={location} className="stock-number">{item.locations.has(location) ? qty(item.locations.get(location).quantity) : '—'}</td>)}
                      <td className="stock-number"><strong>{qty(totalQty)}</strong></td>
                      <td className="stock-number"><strong>{money(totalValue)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
