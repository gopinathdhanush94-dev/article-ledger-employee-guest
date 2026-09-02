import React, { useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import mappingData from '../data/eanArticleMapping.json';

function normalizeEan(v) {
  return String(v ?? '').trim().replace(/\.0$/, '');
}

export default function ArticleNoUpdate({ products = [], isAuthed, onDone, onCancel }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const analysis = useMemo(() => {
    const byEan = new Map();
    products.forEach(p => {
      const ean = normalizeEan(p.ean);
      if (ean) byEan.set(ean, p);
    });

    let matched = 0, unchanged = 0, toUpdate = 0, notFound = 0;
    const updates = [];
    for (const [ean, articleNo] of Object.entries(mappingData.mappings)) {
      const p = byEan.get(ean);
      if (!p) { notFound++; continue; }
      matched++;
      const current = String(p.article_no ?? '').trim();
      if (current === String(articleNo)) unchanged++;
      else {
        toUpdate++;
        updates.push({ ean, article_no: String(articleNo) });
      }
    }

    return {
      totalMappings: Object.keys(mappingData.mappings).length,
      matched, unchanged, toUpdate, notFound,
      conflicts: Object.entries(mappingData.conflicts),
      updates,
    };
  }, [products]);

  async function updateViaRpc() {
    const { data, error } = await supabase.rpc('bulk_update_article_numbers', {
      mappings: analysis.updates,
    });
    if (error) throw error;
    return data;
  }

  async function updateDirect() {
    // Fallback for installations where the optional RPC has not yet been added.
    // Run small parallel batches so the browser does not create thousands of
    // simultaneous requests.
    let updated = 0, failed = 0;
    const CHUNK = 40;
    for (let i = 0; i < analysis.updates.length; i += CHUNK) {
      const chunk = analysis.updates.slice(i, i + CHUNK);
      const results = await Promise.all(chunk.map(async ({ ean, article_no }) => {
        const { error } = await supabase.from('products').update({ article_no }).eq('ean', ean);
        return !error;
      }));
      results.forEach(ok => ok ? updated++ : failed++);
    }
    return { updated, failed };
  }

  async function handleUpdate() {
    if (!isAuthed) return;
    if (!analysis.toUpdate) {
      setResult({ updated: 0, failed: 0, unchanged: analysis.unchanged, notFound: analysis.notFound, message: 'Nothing needs updating.' });
      return;
    }

    const ok = window.confirm(
      `Update Article No. for ${analysis.toUpdate.toLocaleString('en-IN')} articles?\\n\\n` +
      `Only Article No. will be changed. EAN and every other product field will remain unchanged.`
    );
    if (!ok) return;

    setRunning(true);
    setResult(null);
    try {
      let res;
      try {
        res = await updateViaRpc();
      } catch (rpcErr) {
        // Keep the feature usable if the user has not yet run the optional SQL migration.
        res = await updateDirect();
      }
      const updated = Number(res?.updated ?? res?.[0]?.updated ?? analysis.toUpdate);
      const failed = Number(res?.failed ?? res?.[0]?.failed ?? 0);
      setResult({
        updated,
        failed,
        unchanged: analysis.unchanged,
        notFound: analysis.notFound,
        message: failed ? 'Update completed with some failures.' : 'Article numbers updated successfully.',
      });
      if (updated > 0 && onDone) onDone();
    } catch (err) {
      setResult({ updated: 0, failed: analysis.toUpdate, unchanged: analysis.unchanged, notFound: analysis.notFound, message: err.message || String(err) });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="form-wrap">
      <div className="form-card">
        <h2>Update Article No. from EAN</h2>
        <div className="sub">
          The supplied EAN → Article No. master list is built into this update tool.
          Products are matched by EAN only; no other product data is changed.
        </div>

        {!isAuthed && (
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--danger-soft)', color: 'var(--danger)', marginBottom: 16 }}>
            Please sign in as an administrator before updating Article No.
          </div>
        )}

        <div className="form-grid" style={{ marginBottom: 18 }}>
          <div className="field"><label>Mappings in master file</label><div className="static-value">{analysis.totalMappings.toLocaleString('en-IN')}</div></div>
          <div className="field"><label>Matching products</label><div className="static-value">{analysis.matched.toLocaleString('en-IN')}</div></div>
          <div className="field"><label>Need update</label><div className="static-value">{analysis.toUpdate.toLocaleString('en-IN')}</div></div>
          <div className="field"><label>Already correct</label><div className="static-value">{analysis.unchanged.toLocaleString('en-IN')}</div></div>
          <div className="field"><label>EAN not found</label><div className="static-value">{analysis.notFound.toLocaleString('en-IN')}</div></div>
          <div className="field"><label>Conflicting EANs</label><div className="static-value">{analysis.conflicts.length}</div></div>
        </div>

        {analysis.conflicts.length > 0 && (
          <div style={{ padding: 14, border: '1px solid var(--warning, #d99a00)', borderRadius: 8, marginBottom: 18 }}>
            <strong>Manual review required</strong>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              These EANs have more than one Article No. in the supplied file, so they are deliberately not updated automatically.
            </div>
            <button className="btn" style={{ marginTop: 10 }} onClick={() => setShowAll(v => !v)}>
              {showAll ? 'Hide conflicts' : 'Show conflicts'}
            </button>
            {showAll && (
              <div style={{ marginTop: 10, overflowX: 'auto' }}>
                <table className="detail-table">
                  <thead><tr><th>EAN</th><th>Possible Article No.</th></tr></thead>
                  <tbody>
                    {analysis.conflicts.map(([ean, vals]) => (
                      <tr key={ean}><td>{ean}</td><td>{vals.join(' / ')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div style={{ padding: 14, background: 'var(--surface-soft, #f7f7f7)', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
          <strong>What will happen?</strong>
          <ul style={{ margin: '8px 0 0 18px', lineHeight: 1.7 }}>
            <li>{analysis.toUpdate.toLocaleString('en-IN')} matching products will receive their Article No.</li>
            <li>{analysis.unchanged.toLocaleString('en-IN')} products already have the correct Article No. and will not be touched.</li>
            <li>{analysis.notFound.toLocaleString('en-IN')} EANs are not currently in the General catalog.</li>
            <li>The two conflicting EANs are skipped for safety.</li>
          </ul>
        </div>

        {result && (
          <div style={{ padding: 14, borderRadius: 8, marginBottom: 18, background: result.failed ? 'var(--danger-soft)' : 'var(--success-soft, #eef8f0)', color: result.failed ? 'var(--danger)' : 'var(--text)' }}>
            <strong>{result.message}</strong>
            <div style={{ marginTop: 5, fontSize: 13 }}>
              Updated: {result.updated ?? 0} · Failed: {result.failed ?? 0} · Already correct: {result.unchanged ?? 0} · EAN not found: {result.notFound ?? 0}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn" onClick={onCancel} disabled={running}>Cancel</button>
          <button className="btn btn-teal" onClick={handleUpdate} disabled={!isAuthed || running || analysis.toUpdate === 0}>
            {running ? 'Updating…' : `Update ${analysis.toUpdate.toLocaleString('en-IN')} Article No.`}
          </button>
        </div>
      </div>
    </div>
  );
}
