import QRCode from './qrcode/index.js';
import QRErrorCorrectLevel from './qrcode/QRErrorCorrectLevel.js';

const PT_PER_MM = 72 / 25.4;
const PAGE_W = 100 * PT_PER_MM;
const PAGE_H = 50 * PT_PER_MM;
const NAVY = [18, 30, 48];
const MUTED = [92, 105, 120];
const BORDER = [205, 211, 219];
const LIGHT = [247, 249, 252];
const ORANGE = [239, 82, 48];

const plain = value => String(value ?? '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/[–—]/g, '-')
  .replace(/×/g, 'x')
  .replace(/₹/g, 'Rs')
  .replace(/[^\x20-\x7E]/g, '')
  .trim();

const esc = value => plain(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function rgb(c) { return `${c[0] / 255} ${c[1] / 255} ${c[2] / 255}`; }
function y(t) { return PAGE_H - t; }

function wrapText(value, maxChars) {
  const text = plain(value);
  if (!text) return ['-'];
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= maxChars) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

export function qrMatrix(value) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(String(value));
  qr.make();
  return qr.modules;
}

function dimensionsFor(item) {
  const vals = [item?.sku_l, item?.sku_w, item?.sku_h];
  if (vals.every(v => v !== null && v !== undefined && v !== '')) {
    const unit = item?.sku_dim_unit ? ` ${item.sku_dim_unit}` : '';
    return `${vals.map(v => Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })).join(' x ')}${unit}`;
  }
  return plain(item?.dimensions) || '-';
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `Rs ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function drawQr(ops, matrix, x, top, size) {
  const count = matrix.length;
  const quiet = 4;
  const cell = size / (count + quiet * 2);
  ops.push(`q 1 1 1 rg ${x} ${PAGE_H - top - size} ${size} ${size} re f Q`);
  ops.push(`q 0 0 0 rg`);
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!matrix[row][col]) continue;
      const rx = x + (col + quiet) * cell;
      const rt = top + (row + quiet) * cell;
      ops.push(`${rx.toFixed(3)} ${PAGE_H - rt - cell} ${cell.toFixed(3)} ${cell.toFixed(3)} re f`);
    }
  }
  ops.push('Q');
}

function buildLabelStream(item, qrUrl) {
  const ops = [];
  const add = op => ops.push(op);
  const rect = (x, t, w, h, fill) => add(`q ${rgb(fill)} rg ${x} ${PAGE_H - t - h} ${w} ${h} re f Q`);
  const line = (x1, t1, x2, t2, stroke=BORDER, width=.6) => add(`q ${width} w ${rgb(stroke)} RG ${x1} ${y(t1)} m ${x2} ${y(t2)} l S Q`);
  const text = (value, x, t, size=8, color=NAVY, font='F1') => add(`BT ${rgb(color)} rg /${font} ${size} Tf 1 0 0 1 ${x} ${y(t)} Tm (${esc(value)}) Tj ET`);
  const bold = (value, x, t, size=8, color=NAVY) => text(value, x, t, size, color, 'F2');

  rect(0, 0, PAGE_W, PAGE_H, [255, 255, 255]);
  rect(0, 0, 3.5, PAGE_H, ORANGE);
  rect(3.5, 0, 96.5, 8, LIGHT);
  bold('G-RECORDS  |  ARTICLE LEDGER', 8, 5.5, 5.6, ORANGE);
  const qrSize = 34;
  // Keep a full standards-compliant quiet zone around the QR modules so
  // phone cameras can decode labels reliably after printing/scaling.
  const qrX = 7;
  const qrTop = 10.5;
  drawQr(ops, qrMatrix(qrUrl), qrX, qrTop, qrSize);
  text('SCAN FOR PRODUCT DETAILS', qrX + 1, 45.8, 3.7, MUTED, 'F2');

  const x = 45;
  const rightX = 95;
  const article = plain(item?.article_no || item?.ean || item?.id || '-');
  const model = plain(item?.model || '-');
  const description = plain(item?.description || item?.name || model || 'Product');
  const descLines = wrapText(description, 42).slice(0, 2);

  text('ARTICLE / SKU', x, 15.5, 5.0, MUTED, 'F2');
  bold(article, x, 21.5, 8.2, NAVY);
  if (model && model !== '-') {
    text(`MODEL: ${model}`, x, 26.5, 5.2, MUTED);
  }

  descLines.forEach((lineText, i) => text(lineText, x, 31.5 + i * 4.5, 6.1, NAVY, i === 0 ? 'F2' : 'F1'));

  const metaTop = 40.5;
  text('L x B x H', x, metaTop, 5.0, MUTED, 'F2');
  bold(dimensionsFor(item), x + 21, metaTop, 5.9, NAVY);
  text('MRP', x, 46.0, 5.0, MUTED, 'F2');
  bold(money(item?.mrp), x + 21, 46.0, 6.7, NAVY);


  return ops.join('\n');
}

export function createQrLabelPdf(items, { origin = window.location.origin } = {}) {
  if (!Array.isArray(items) || !items.length) throw new Error('Select at least one showroom item.');

  const pages = items.map(item => {
    const qrCode = item?.ean || item?.article_no || item?.model || item?.id;
    const params = new URLSearchParams({ qr: String(qrCode || '') });
    const qrUrl = `${origin.replace(/\/$/, '')}/?${params.toString()}`;
    return buildLabelStream(item, qrUrl);
  });

  const encoder = new TextEncoder();
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >> >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  const pageNums = pages.map((_, i) => 5 + i * 2);
  objects[1] = `<< /Type /Pages /Kids [${pageNums.map(n => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`;

  pages.forEach(stream => {
    const p = objects.length + 1;
    const c = p + 1;
    const streamBytes = encoder.encode(stream).length;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /ProcSet [/PDF /Text] /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${c} 0 R >>`);
    objects.push(`<< /Length ${streamBytes} >>\r\nstream\r\n${stream}\r\nendstream`);
  });

  let pdf = '%PDF-1.4\r\n';
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets[i + 1] = encoder.encode(pdf).length;
    pdf += `${i + 1} 0 obj\r\n${obj}\r\nendobj\r\n`;
  });
  const xref = encoder.encode(pdf).length;
  pdf += `xref\r\n0 ${objects.length + 1}\r\n0000000000 65535 f \r\n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \r\n`;
  pdf += `trailer\r\n<< /Size ${objects.length + 1} /Root 1 0 R >>\r\nstartxref\r\n${xref}\r\n%%EOF\r\n`;

  const bytes = encoder.encode(pdf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  const dataUrl = `data:application/pdf;base64,${btoa(binary)}`;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `G-Records-Showroom-QR-Labels-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 3000);
}

export { dimensionsFor, money };
