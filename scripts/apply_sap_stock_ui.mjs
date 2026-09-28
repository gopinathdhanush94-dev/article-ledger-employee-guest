import fs from 'node:fs';

const root = process.cwd();

function edit(path, transform) {
  const file = `${root}/${path}`;
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change made to ${path}`);
  fs.writeFileSync(file, after);
  console.log(`updated ${path}`);
}

function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label || from}: expected 1 match, found ${count}`);
  return text.replace(from, to);
}

edit('src/lib/useAuth.js', text => {
  let out = text.replaceAll('canHistory: true,', 'canHistory: true, canViewStock: true,');
  out = out.replaceAll('canHistory: false,', 'canHistory: false, canViewStock: false,');
  return out;
});

edit('src/App.jsx', text => {
  let out = text;
  out = replaceOnce(out, "import AccessGate from './components/AccessGate.jsx';", "import AccessGate from './components/AccessGate.jsx';\nimport SapStock from './components/SapStock.jsx';", 'App import');
  out = replaceOnce(out, "'showroom', 'showroom-orders'", "'showroom', 'showroom-orders', 'stock'", 'App valid views');
  out = replaceOnce(out, "'showroom-orders': permissions.canManageQuotations,", "'showroom-orders': permissions.canManageQuotations,\n    stock: permissions.canViewStock,", 'App view permission');
  out = replaceOnce(out, "{permissions.canViewGeneral && <button className={view === 'catalog' ? 'active' : ''} onClick={() => { setCatalogFilters(null); navigate('catalog'); }}>General</button>}", "{permissions.canViewGeneral && <button className={view === 'catalog' ? 'active' : ''} onClick={() => { setCatalogFilters(null); navigate('catalog'); }}>General</button>}\n          {permissions.canViewStock && <button className={view === 'stock' ? 'active' : ''} onClick={() => navigate('stock')}>SAP Stock</button>}", 'App stock tab');
  out = replaceOnce(out, "              canDelete={permissions.canDelete}\n            />", "              canDelete={permissions.canDelete}\n              canViewStock={permissions.canViewStock}\n            />", 'Catalog stock permission prop');
  out = replaceOnce(out, "          <div style={{ display: view === 'garments' ? 'block' : 'none' }}>", "          <div style={{ display: view === 'stock' ? 'block' : 'none' }}>\n            <SapStock />\n          </div>\n          <div style={{ display: view === 'garments' ? 'block' : 'none' }}>", 'App stock screen');
  return out;
});

edit('src/components/Catalog.jsx', text => {
  let out = text;
  out = replaceOnce(out, "export default function Catalog({ products, initialFilters, onEdit, onDuplicate, onDelete, isAuthed, lookupCode, active = true })", "export default function Catalog({ products, initialFilters, onEdit, onDuplicate, onDelete, isAuthed, lookupCode, active = true, canViewStock = false })", 'Catalog props');
  out = replaceOnce(out, "          isAuthed={isAuthed}\n          onClose={() => setSelected(null)}", "          isAuthed={isAuthed}\n          canViewStock={canViewStock}\n          onClose={() => setSelected(null)}", 'Catalog ProductModal stock prop');
  return out;
});

edit('src/components/ProductModal.jsx', text => {
  let out = text;
  out = replaceOnce(out, "export default function ProductModal({ product: p, isAuthed, onClose, onEdit, onDuplicate, onDelete, onPrev, onNext }) {", "export default function ProductModal({ product: p, isAuthed, canViewStock = false, onClose, onEdit, onDuplicate, onDelete, onPrev, onNext }) {", 'ProductModal props');
  out = replaceOnce(out, "  const [showImageViewer, setShowImageViewer] = useState(false);", "  const [showImageViewer, setShowImageViewer] = useState(false);\n  const [stockRows, setStockRows] = useState([]);\n  const [stockLoading, setStockLoading] = useState(false);\n  const [stockError, setStockError] = useState(null);", 'ProductModal stock state');
  out = replaceOnce(out, "  useEffect(() => {\n    if (!isAuthed || !p?.id) { setHistory([]); return; }", "  useEffect(() => {\n    if (!canViewStock || !p?.ean) { setStockRows([]); setStockLoading(false); setStockError(null); return; }\n    let cancelled = false;\n    setStockLoading(true);\n    setStockError(null);\n    supabase.from('article_stock_summary').select('ean,sap_material_code,item_name,total_quantity,total_stock_value,locations,last_synced_at').eq('ean', String(p.ean).trim()).order('sap_material_code', { ascending: true })\n      .then(({ data, error }) => {\n        if (cancelled) return;\n        if (error) { setStockError(error.message); setStockRows([]); }\n        else setStockRows(data || []);\n        setStockLoading(false);\n      });\n    return () => { cancelled = true; };\n  }, [p?.ean, canViewStock]);\n\n  useEffect(() => {\n    if (!isAuthed || !p?.id) { setHistory([]); return; }");
  out = replaceOnce(out, "                <section className=\"pd-section pd-sku-section\">", `                {canViewStock && (\n                  <section className="pd-section pd-stock-section">\n                    <div className="pd-section-heading">\n                      <h3>SAP STOCK</h3>\n                      <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Live snapshot mapped by EAN</span>\n                    </div>\n                    {stockLoading ? (\n                      <div className="quality-empty">Loading stock…</div>\n                    ) : stockError ? (\n                      <div className="inline-notice danger">Could not load stock: {stockError}</div>\n                    ) : stockRows.length === 0 ? (\n                      <div className="quality-empty">No SAP stock is currently mapped to this EAN.</div>\n                    ) : (\n                      <div style={{ display: 'grid', gap: 10 }}>\n                        {stockRows.map((row) => (\n                          <div key={row.sap_material_code || row.ean} style={{ border: '1px solid var(--line, #ddd)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,0.45)' }}>\n                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 9 }}>\n                              <div><strong>{row.sap_material_code || 'SAP material —'}</strong><div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 3 }}>{row.item_name || 'SAP item'}</div></div>\n                              <div style={{ display: 'flex', gap: 16, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>\n                                <span><b>{Number(row.total_quantity || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</b> Qty</span>\n                                <span><b>₹{Number(row.total_stock_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>\n                              </div>\n                            </div>\n                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 7 }}>\n                              {(Array.isArray(row.locations) ? row.locations : []).map((loc, index) => (\n                                <div key={loc.location || index} style={{ border: '1px solid var(--line, #ddd)', borderRadius: 8, padding: '7px 9px' }}>\n                                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-soft)' }}>{loc.location || 'Unspecified'}</div>\n                                  <strong>{Number(loc.quantity || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</strong>\n                                  <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>₹{Number(loc.stock_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>\n                                </div>\n                              ))}\n                            </div>\n                          </div>\n                        ))}\n                      </div>\n                    )}\n                  </section>\n                )}\n\n                <section className="pd-section pd-sku-section">`, 'ProductModal stock section');
  return out;
});

edit('src/components/SapStock.jsx', text => {
  let out = text;
  out = out.replaceAll('permissions?.canView', 'permissions?.canViewStock');
  return out;
});

edit('src/components/Home.jsx', text => {
  let out = text;
  out = out.replaceAll('permissions?.canView &&', 'permissions?.canViewStock &&');
  return out;
});

console.log('SAP stock UI patch complete');
