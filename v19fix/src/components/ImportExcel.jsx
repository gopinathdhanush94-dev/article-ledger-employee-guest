import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient.js';
import { isValidEan } from '../lib/helpers.js';
import { useDialogs } from './Dialogs.jsx';

const PRODUCT_FIELDS = [
  { key: 'category', label: 'Category', type: 'text', required: true },
  { key: 'brand', label: 'Brand', type: 'text', required: true },
  { key: 'model', label: 'Model', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'ean', label: 'EAN Code', type: 'text' },
  { key: 'mrp', label: 'MRP', type: 'number' },
  { key: 'sp', label: 'Selling Price', type: 'number' },
  { key: 'hsn', label: 'HSN Code', type: 'text' },
  { key: 'article_no', label: 'Article No.', type: 'text' },
  { key: 'marketed_by', label: 'Marketed By', type: 'text' },
  { key: 'month', label: 'Month / Batch', type: 'text' },
  { key: 'master_qty', label: 'Master Carton Qty', type: 'number' },
  { key: 'inner_qty', label: 'Inner Carton Qty', type: 'number' },
  { key: 'sku_l', label: 'SKU Length', type: 'number' },
  { key: 'sku_w', label: 'SKU Width', type: 'number' },
  { key: 'sku_h', label: 'SKU Height', type: 'number' },
  { key: 'sku_dim_unit', label: 'SKU Dim Unit', type: 'text' },
  { key: 'sku_nw', label: 'SKU Net Weight', type: 'number' },
  { key: 'sku_gw', label: 'SKU Gross Weight', type: 'number' },
  { key: 'sku_wt_unit', label: 'SKU Weight Unit', type: 'text' },
  { key: 'master_l', label: 'Master Ctn Length', type: 'number' },
  { key: 'master_w', label: 'Master Ctn Width', type: 'number' },
  { key: 'master_h', label: 'Master Ctn Height', type: 'number' },
  { key: 'master_dim_unit', label: 'Master Ctn Dim Unit', type: 'text' },
  { key: 'master_nw', label: 'Master Ctn Net Weight', type: 'number' },
  { key: 'master_gw', label: 'Master Ctn Gross Weight', type: 'number' },
  { key: 'master_wt_unit', label: 'Master Ctn Weight Unit', type: 'text' },
  { key: 'inner_l', label: 'Inner Ctn Length', type: 'number' },
  { key: 'inner_w', label: 'Inner Ctn Width', type: 'number' },
  { key: 'inner_h', label: 'Inner Ctn Height', type: 'number' },
  { key: 'inner_dim_unit', label: 'Inner Ctn Dim Unit', type: 'text' },
  { key: 'inner_nw', label: 'Inner Ctn Net Weight', type: 'number' },
  { key: 'inner_gw', label: 'Inner Ctn Gross Weight', type: 'number' },
  { key: 'inner_wt_unit', label: 'Inner Ctn Weight Unit', type: 'text' },
];

const GARMENT_FIELDS = [
  { key: 'excel_name', label: 'Style Name', type: 'text', required: true },
  { key: 'brand', label: 'Brand', type: 'text', required: true },
  { key: 'model_name', label: 'Garment Type', type: 'text' },
  { key: 'model1', label: 'Internal Model', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'color', label: 'Color', type: 'text' },
  { key: 'customer_model', label: 'Customer Model', type: 'text' },
  { key: 'origin', label: 'Origin', type: 'text' },
  { key: 'moi', label: 'MOI', type: 'text' },
  { key: 'mfd', label: 'MFD', type: 'text' },
  { key: 'sheet', label: 'Month / Batch', type: 'text' },
  { key: 'source_file', label: 'Collection / Source', type: 'text' },
  { key: 'size', label: 'Size', type: 'text', required: true },
  { key: 'ratio', label: 'Set Qty (Ratio)', type: 'number' },
  { key: 'master_ean', label: 'Master EAN', type: 'text' },
  { key: 'master_article', label: 'Master Article', type: 'text' },
  { key: 'ean', label: 'EAN', type: 'text' },
  { key: 'article', label: 'Article', type: 'text' },
  { key: 'ctn_no', label: 'Carton No.', type: 'text' },
  { key: 'mrp', label: 'MRP', type: 'number' },
  { key: 'rrp', label: 'RRP', type: 'number' },
];

export default function ImportExcel({ onDone, onCancel }) {
  const dialogs = useDialogs();
  const [targetTable, setTargetTable] = useState('products');
  const [workbook, setWorkbook] = useState(null);
  const [sheetName, setSheetName] = useState('');
  const [headerRow, setHeaderRow] = useState(1);
  const [dataStartRow, setDataStartRow] = useState(2);
  const [mapping, setMapping] = useState({}); // colIndex -> field key
  const [fillDown, setFillDown] = useState({}); // colIndex -> bool
  const [fixedValues, setFixedValues] = useState({}); // fieldKey -> value
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const fields = targetTable === 'products' ? PRODUCT_FIELDS : GARMENT_FIELDS;

  const sheet = workbook && sheetName ? workbook.Sheets[sheetName] : null;
  const aoa = useMemo(() => {
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  }, [sheet]);

  const headers = aoa[headerRow - 1] || [];
  const dataRows = aoa.slice(dataStartRow - 1);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'array' });
      setWorkbook(wb);
      setSheetName(wb.SheetNames[0]);
      setMapping({});
      setFillDown({});
      setFixedValues({});
      setResult(null);
    };
    reader.readAsArrayBuffer(file);
  }

  function setColMapping(colIndex, fieldKey) {
    setMapping(m => ({ ...m, [colIndex]: fieldKey }));
  }
  function toggleFillDown(colIndex) {
    setFillDown(f => ({ ...f, [colIndex]: !f[colIndex] }));
  }
  function setFixed(fieldKey, val) {
    setFixedValues(f => ({ ...f, [fieldKey]: val }));
  }

  const mappedFieldKeys = new Set(Object.values(mapping).filter(Boolean));
  const unmappedFields = fields.filter(f => !mappedFieldKeys.has(f.key));

  function coerce(field, raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    if (field.type === 'number') {
      const n = parseFloat(raw);
      return isNaN(n) ? null : n;
    }
    return String(raw).trim() || null;
  }

  function buildRows() {
    const fillState = {};
    const out = [];
    for (const row of dataRows) {
      if (!row || row.every(v => v === null || v === '')) continue;
      const rec = {};
      for (const [colIndexStr, fieldKey] of Object.entries(mapping)) {
        if (!fieldKey) continue;
        const colIndex = Number(colIndexStr);
        let raw = row[colIndex];
        if ((raw === null || raw === '') && fillDown[colIndex] && fillState[colIndex] !== undefined) {
          raw = fillState[colIndex];
        } else if (raw !== null && raw !== '') {
          fillState[colIndex] = raw;
        }
        const field = fields.find(f => f.key === fieldKey);
        rec[fieldKey] = coerce(field, raw);
      }
      for (const f of unmappedFields) {
        if (fixedValues[f.key] !== undefined && fixedValues[f.key] !== '') {
          rec[f.key] = coerce(f, fixedValues[f.key]);
        }
      }
      out.push(rec);
    }
    return out;
  }

  const previewRows = useMemo(() => buildRows().slice(0, 5), [mapping, fillDown, fixedValues, dataRows]); // eslint-disable-line

  async function fetchExistingEans() {
    const pageSize = 1000;
    const eans = new Set();
    let from = 0;
    while (true) {
      const { data, error } = await supabase.from(targetTable).select('ean').range(from, from + pageSize - 1);
      if (error) throw error;
      (data || []).forEach(r => { if (r.ean) eans.add(r.ean); });
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    return eans;
  }

  async function handleImport() {
    const requiredMissing = fields.filter(f => f.required && !mappedFieldKeys.has(f.key) && !fixedValues[f.key]);
    if (requiredMissing.length > 0) {
      dialogs.alertDialog({
        title: 'Missing required fields',
        message: `Please map or set a fixed value for: ${requiredMissing.map(f => f.label).join(', ')}`,
      });
      return;
    }

    setImporting(true);
    setResult(null);
    try {
      const existingEans = await fetchExistingEans();
      const rows = buildRows();
      const seenInFile = new Set();
      const toInsert = [];
      let skippedDupEan = 0, skippedInvalidEan = 0;

      for (const rec of rows) {
        let ean = rec.ean || null;
        if (targetTable === 'products') {
          ean = isValidEan(ean) ? ean : null;
          if (rec.ean && !ean) { skippedInvalidEan++; continue; }
        }
        if (ean) {
          if (existingEans.has(ean) || seenInFile.has(ean)) { skippedDupEan++; continue; }
          seenInFile.add(ean);
        }
        toInsert.push({ ...rec, ean, custom: true });
      }

      let inserted = 0, failed = 0;
      const CHUNK = 300;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const { error } = await supabase.from(targetTable).insert(chunk);
        if (error) { failed += chunk.length; console.warn('Batch insert failed:', error.message); }
        else inserted += chunk.length;
      }

      setResult({ total: rows.length, inserted, skippedDupEan, skippedInvalidEan, failed });
      if (inserted > 0) onDone();
    } catch (err) {
      dialogs.alertDialog({ title: 'Import failed', message: err.message || String(err) });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="form-wrap">
      <div className="form-card">
        <h2>Import from Excel</h2>
        <div className="sub">
          Upload a spreadsheet, map its columns to the right fields yourself, preview the result, then import.
          Note: this imports text/number data only — product photos aren't extracted from the file this way;
          add those afterward via Edit.
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Import into</label>
            <select value={targetTable} onChange={(e) => { setTargetTable(e.target.value); setMapping({}); setFixedValues({}); }}>
              <option value="products">General Articles</option>
              <option value="garments">Garments</option>
            </select>
          </div>
          <div className="field">
            <label>Excel / CSV File</label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
          </div>

          {workbook && (
            <>
              <div className="field">
                <label>Sheet</label>
                <select value={sheetName} onChange={(e) => setSheetName(e.target.value)}>
                  {workbook.SheetNames.map(sn => <option key={sn} value={sn}>{sn}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Header Row Number</label>
                <input type="number" min="1" value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value) || 1)} />
              </div>
              <div className="field">
                <label>Data Starts At Row</label>
                <input type="number" min="1" value={dataStartRow} onChange={(e) => setDataStartRow(Number(e.target.value) || 2)} />
              </div>
            </>
          )}
        </div>

        {workbook && headers.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 24, marginBottom: 12 }}>
              Map your columns ({headers.filter(Boolean).length} found)
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--rule)', borderRadius: 6, marginBottom: 20 }}>
              <table className="detail-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--ink)' }}>
                    <td style={{ fontWeight: 700 }}>Source Column</td>
                    <td style={{ fontWeight: 700 }}>Sample Value</td>
                    <td style={{ fontWeight: 700 }}>Maps To</td>
                    <td style={{ fontWeight: 700 }}>Fill Blanks Down</td>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h, i) => {
                    if (h === null && !dataRows.some(r => r && r[i] !== null && r[i] !== '')) return null;
                    const sample = dataRows.find(r => r && r[i] !== null && r[i] !== '')?.[i];
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{h || `Column ${i + 1}`}</td>
                        <td style={{ color: 'var(--ink-soft)' }}>{sample != null ? String(sample).slice(0, 40) : '—'}</td>
                        <td>
                          <select value={mapping[i] || ''} onChange={(e) => setColMapping(i, e.target.value)} style={{ minWidth: 160 }}>
                            <option value="">— Ignore —</option>
                            {fields.map(f => <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>)}
                          </select>
                        </td>
                        <td>
                          <input type="checkbox" checked={!!fillDown[i]} onChange={() => toggleFillDown(i)} title="Use the value above when this cell is blank (for grouped rows)" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {unmappedFields.length > 0 && (
              <>
                <div className="section-label" style={{ marginBottom: 12 }}>
                  Fixed values (for fields not present as a column — applies to every row)
                </div>
                <div className="form-grid" style={{ marginBottom: 20 }}>
                  {unmappedFields.map(f => (
                    <div className="field" key={f.key}>
                      <label>{f.label}{f.required ? ' *' : ''}</label>
                      <input
                        type={f.type === 'number' ? 'number' : 'text'}
                        value={fixedValues[f.key] || ''}
                        onChange={(e) => setFixed(f.key, e.target.value)}
                        placeholder={f.required ? 'Required — map a column or set this' : 'Optional'}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="section-label" style={{ marginBottom: 12 }}>
              Preview (first 5 rows) — {dataRows.filter(r => r && !r.every(v => v === null || v === '')).length} data rows detected total
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--rule)', borderRadius: 6, marginBottom: 20 }}>
              <table className="detail-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--ink)' }}>
                    {[...mappedFieldKeys, ...unmappedFields.filter(f => fixedValues[f.key]).map(f => f.key)].map(k => (
                      <td key={k} style={{ fontWeight: 700 }}>{fields.find(f => f.key === k)?.label || k}</td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      {[...mappedFieldKeys, ...unmappedFields.filter(f => fixedValues[f.key]).map(f => f.key)].map(k => (
                        <td key={k}>{r[k] != null ? String(r[k]) : '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result && (
              <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 12.5, marginBottom: 20, padding: '14px 16px', border: '1px solid var(--rule)', borderRadius: 6, background: 'var(--paper)' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Import complete</div>
                <div>Total rows read: {result.total}</div>
                <div style={{ color: 'var(--teal)' }}>Inserted: {result.inserted}</div>
                <div>Skipped (duplicate EAN): {result.skippedDupEan}</div>
                <div>Skipped (invalid EAN): {result.skippedInvalidEan}</div>
                {result.failed > 0 && <div style={{ color: 'var(--danger)' }}>Failed: {result.failed}</div>}
              </div>
            )}
          </>
        )}

        <div className="form-footer">
          <button type="button" className="btn" onClick={onCancel}>Close</button>
          {workbook && headers.length > 0 && (
            <button type="button" className="btn btn-primary" disabled={importing} onClick={handleImport}>
              {importing ? 'Importing…' : `Import ${dataRows.filter(r => r && !r.every(v => v === null || v === '')).length} rows`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
