import QRCode from './qrcode/index.js';
import QRErrorCorrectLevel from './qrcode/QRErrorCorrectLevel.js';

const MM = 72 / 25.4;
const A4_W = 210 * MM;
const A4_H = 297 * MM;
const LABEL_W = 100 * MM;
const LABEL_H = 50 * MM;
const MARGIN_X = 5 * MM;
const TOP_MARGIN = (A4_H - 5 * LABEL_H) / 2;
const GAP_X = 0;
const GAP_Y = 0;
const NAVY = [10, 28, 52];
const BLUE = [31, 111, 235];
const PALE_BLUE = [239, 246, 255];
const MUTED = [90, 105, 124];
const BORDER = [201, 211, 225];
const WHITE = [255, 255, 255];

const plain = value => String(value ?? '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/[–—]/g, '-')
  .replace(/×/g, 'x')
  .replace(/₹/g, 'Rs')
  .replace(/[^\x20-\x7E]/g, '')
  .trim();
const esc = value => plain(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
function rgb(c) { return `${c[0] / 255} ${c[1] / 255} ${c[2] / 255}`; }
function py(t) { return A4_H - t; }

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
    const unit = item?.sku_dim_unit ? ` ${item.sku_dim_unit}` : ' cm';
    return `${vals.map(v => Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })).join(' x ')}${unit}`;
  }
  return plain(item?.dimensions) || '-';
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `Rs ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dataUrlBytes(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function loadLogoJpeg() {
  try {
    const response = await fetch('/g-logo.png', { cache: 'force-cache' });
    if (!response.ok) return null;
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 600 / bitmap.width);
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return { bytes: dataUrlBytes(canvas.toDataURL('image/jpeg', 0.88)), width: canvas.width, height: canvas.height };
  } catch (_) {
    return null;
  }
}

function drawQr(ops, matrix, x, top, size) {
  const count = matrix.length;
  const quiet = 4;
  const cell = size / (count + quiet * 2);
  ops.push(`q 1 1 1 rg ${x.toFixed(3)} ${A4_H - top - size} ${size.toFixed(3)} ${size.toFixed(3)} re f Q`);
  ops.push('q 0 0 0 rg');
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!matrix[row][col]) continue;
      const rx = x + (col + quiet) * cell;
      const rt = top + (row + quiet) * cell;
      ops.push(`${rx.toFixed(3)} ${A4_H - rt - cell} ${cell.toFixed(3)} ${cell.toFixed(3)} re f`);
    }
  }
  ops.push('Q');
}

function labelStream(item, qrUrl, logoName = null, x0, top0) {
  const ops = [];
  const add = op => ops.push(op);
  const rect = (x, t, w, h, fill) => add(`q ${rgb(fill)} rg ${x.toFixed(3)} ${A4_H - t - h} ${w.toFixed(3)} ${h.toFixed(3)} re f Q`);
  const strokeRect = (x, t, w, h, color=BORDER, width=.55) => add(`q ${width} w ${rgb(color)} RG ${x.toFixed(3)} ${A4_H - t - h} ${w.toFixed(3)} ${h.toFixed(3)} re S Q`);
  const line = (x1, t1, x2, t2, color=BORDER, width=.55) => add(`q ${width} w ${rgb(color)} RG ${x1.toFixed(3)} ${py(t1).toFixed(3)} m ${x2.toFixed(3)} ${py(t2).toFixed(3)} l S Q`);
  const text = (value, x, t, size=8, color=NAVY, font='F1') => add(`BT ${rgb(color)} rg /${font} ${size} Tf 1 0 0 1 ${x.toFixed(3)} ${py(t).toFixed(3)} Tm (${esc(value)}) Tj ET`);
  const bold = (value, x, t, size=8, color=NAVY) => text(value, x, t, size, color, 'F2');

  rect(x0, top0, LABEL_W, LABEL_H, WHITE);
  strokeRect(x0 + .4, top0 + .4, LABEL_W - .8, LABEL_H - .8, BORDER, .65);
  rect(x0, top0, LABEL_W, 2.8 * MM, NAVY);
  rect(x0 + LABEL_W - 18 * MM, top0, 18 * MM, 2.8 * MM, BLUE);

  if (logoName) {
    const lw = 6.5 * MM, lh = 6.5 * MM;
    add(`q ${lw.toFixed(3)} 0 0 ${lh.toFixed(3)} ${(x0 + 4 * MM).toFixed(3)} ${(A4_H - (top0 + 9.0 * MM)).toFixed(3)} cm /${logoName} Do Q`);
  }

  const qrSize = 31 * MM;
  const qrX = x0 + 5 * MM;
  const qrTop = top0 + 8 * MM;
  drawQr(ops, qrMatrix(qrUrl), qrX, qrTop, qrSize);

  const contentX = x0 + 40 * MM;
  const contentW = 55 * MM;
  const article = plain(item?.article_no || item?.ean || item?.id || '-');
  const model = plain(item?.model || '');
  const description = plain(item?.description || item?.name || item?.model || 'Product');
  const descLines = wrapText(description, 29).slice(0, 3);

  // Small SKU badge, while keeping the product description visually dominant.
  rect(contentX, top0 + 5 * MM, Math.min(contentW, 32 * MM), 5.8 * MM, PALE_BLUE);
  bold(`SKU: ${article}`, contentX + 2.2 * MM, top0 + 8.9 * MM, 7.2, BLUE);

  descLines.forEach((lineText, i) => bold(lineText, contentX, top0 + 16.5 * MM + i * 5.0 * MM, i === 0 ? 12.2 : 10.4, NAVY));
  if (model && model !== '-') text(`MODEL: ${model}`, contentX, top0 + 32 * MM, 6.5, MUTED, 'F2');

  line(contentX, top0 + 35 * MM, x0 + LABEL_W - 5 * MM, top0 + 35 * MM, [221, 228, 238], .45);
  text('DIMENSIONS (L x B x H)', contentX, top0 + 39.0 * MM, 5.5, MUTED, 'F2');
  bold(dimensionsFor(item), contentX, top0 + 43.0 * MM, 7.0, NAVY);
  text(`EAN: ${plain(item?.ean || '-')}`, contentX, top0 + 47.0 * MM, 5.8, MUTED, 'F1');

  // Prominent MRP block on the right/bottom.
  const mrpX = x0 + 76 * MM;
  text('MRP', mrpX, top0 + 38.8 * MM, 6.0, BLUE, 'F2');
  bold(money(item?.mrp), mrpX, top0 + 46.2 * MM, 14.5, NAVY);

  return ops.join('\n');
}

function buildPdf(objects, pages, logoBytes) {
  const encoder = new TextEncoder();
  const pageNums = [];
  const contentNums = [];
  const logoObj = logoBytes ? 3 : null;

  objects.push('<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >> >>');
  objects.push('');
  if (logoBytes) objects.push(`<< /Type /XObject /Subtype /Image /Width ${logoAsset?.width || 1} /Height ${logoAsset?.height || 1} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\r\nstream\r\n` + logoBytes + '\r\nendstream');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const firstPageObj = 5 + (logoBytes ? 1 : 0);
  pages.forEach((stream, i) => {
    const p = firstPageObj + i * 2;
    pageNums.push(p);
    contentNums.push(p + 1);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageNums.map(n => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`;

  pages.forEach((stream, i) => {
    const p = objects.length + 1;
    const c = p + 1;
    const resources = logoBytes
      ? `<< /ProcSet [/PDF /Text /ImageC] /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 3 0 R >> >>`
      : `<< /ProcSet [/PDF /Text] /Font << /F1 3 0 R /F2 4 0 R >> >>`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W.toFixed(3)} ${A4_H.toFixed(3)}] /Resources ${resources} /Contents ${c} 0 R >>`);
    objects.push(`<< /Length ${encoder.encode(stream).length} >>\r\nstream\r\n${stream}\r\nendstream`);
  });

  let pdf = '%PDF-1.4\r\n';
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets[i + 1] = encoder.encode(pdf).length;
    if (obj instanceof Uint8Array) {
      pdf += `${i + 1} 0 obj\r\n`;
      // not used in current path
    } else pdf += `${i + 1} 0 obj\r\n${obj}\r\nendobj\r\n`;
  });
  const xref = encoder.encode(pdf).length;
  pdf += `xref\r\n0 ${objects.length + 1}\r\n0000000000 65535 f \r\n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \r\n`;
  pdf += `trailer\r\n<< /Size ${objects.length + 1} /Root 1 0 R >>\r\nstartxref\r\n${xref}\r\n%%EOF\r\n`;

  return new TextEncoder().encode(pdf);
}

export async function createQrLabelPdf(items, { origin = window.location.origin } = {}) {
  if (!Array.isArray(items) || !items.length) throw new Error('Select at least one showroom item.');

  const logoAsset = await loadLogoJpeg();
  const logoBytes = logoAsset?.bytes || null;
  const pages = [];
  for (let start = 0; start < items.length; start += 10) {
    const pageItems = items.slice(start, start + 10);
    const ops = [];
    ops.push(`q 1 1 1 rg 0 0 ${A4_W.toFixed(3)} ${A4_H.toFixed(3)} re f Q`);
    pageItems.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = MARGIN_X + col * (LABEL_W + GAP_X);
      const top = TOP_MARGIN + row * (LABEL_H + GAP_Y);
      const qrCode = item?.ean || item?.article_no || item?.model || item?.id;
      const qrUrl = `${origin.replace(/\/$/, '')}/?qr=${encodeURIComponent(String(qrCode || ''))}`;
      ops.push(labelStream(item, qrUrl, logoBytes ? 'Im1' : null, x, top));
    });
    // Fine cut guides around the sheet and between label edges.
    const guide = (x1, t1, x2, t2) => ops.push(`q .35 w ${rgb([170,180,194])} RG [2 2] 0 d ${x1.toFixed(3)} ${py(t1).toFixed(3)} m ${x2.toFixed(3)} ${py(t2).toFixed(3)} l S Q`);
    guide(MARGIN_X, TOP_MARGIN, MARGIN_X, TOP_MARGIN + 5 * LABEL_H);
    guide(MARGIN_X + LABEL_W, TOP_MARGIN, MARGIN_X + LABEL_W, TOP_MARGIN + 5 * LABEL_H);
    guide(MARGIN_X + 2 * LABEL_W, TOP_MARGIN, MARGIN_X + 2 * LABEL_W, TOP_MARGIN + 5 * LABEL_H);
    for (let r = 0; r <= 5; r++) guide(MARGIN_X, TOP_MARGIN + r * LABEL_H, MARGIN_X + 2 * LABEL_W, TOP_MARGIN + r * LABEL_H);
    pages.push(ops.join('\n'));
  }

  // The logo is JPEG encoded but object construction above needs raw binary; build manually here.
  const encoder = new TextEncoder();
  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >> >>');
  objects.push('');
  if (logoBytes) objects.push({ image: logoBytes });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageStart = objects.length + 1;
  const kids = [];
  pages.forEach((stream, i) => {
    const p = pageStart + i * 2;
    kids.push(`${p} 0 R`);
  });
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  pages.forEach(stream => {
    const p = objects.length + 1;
    const c = p + 1;
    const fontOffset = logoBytes ? 4 : 3;
    const fontBoldOffset = logoBytes ? 5 : 4;
    const resources = logoBytes
      ? `<< /ProcSet [/PDF /Text /ImageC] /Font << /F1 ${fontOffset} 0 R /F2 ${fontBoldOffset} 0 R >> /XObject << /Im1 3 0 R >> >>`
      : `<< /ProcSet [/PDF /Text] /Font << /F1 ${fontOffset} 0 R /F2 ${fontBoldOffset} 0 R >> >>`;
    objects.push({ raw: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W.toFixed(3)} ${A4_H.toFixed(3)}] /Resources ${resources} /Contents ${c} 0 R >>` });
    objects.push({ raw: `<< /Length ${encoder.encode(stream).length} >>\r\nstream\r\n${stream}\r\nendstream` });
  });

  const chunks = [];
  const offsets = [0];
  let byteLen = 0;
  const push = str => { const b = encoder.encode(str); chunks.push(b); byteLen += b.length; };
  push('%PDF-1.4\r\n');
  for (let i = 0; i < objects.length; i++) {
    offsets[i + 1] = byteLen;
    const obj = objects[i];
    if (obj?.image) {
      push(`${i + 1} 0 obj\r\n`);
      push(`<< /Type /XObject /Subtype /Image /Width ${logoAsset?.width || 1} /Height ${logoAsset?.height || 1} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${obj.image.length} >>\r\nstream\r\n`);
      chunks.push(obj.image); byteLen += obj.image.length;
      push('\r\nendstream\r\nendobj\r\n');
    } else {
      push(`${i + 1} 0 obj\r\n${obj.raw || obj}\r\nendobj\r\n`);
    }
  }
  const xref = byteLen;
  push(`xref\r\n0 ${objects.length + 1}\r\n0000000000 65535 f \r\n`);
  for (let i = 1; i <= objects.length; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \r\n`);
  push(`trailer\r\n<< /Size ${objects.length + 1} /Root 1 0 R >>\r\nstartxref\r\n${xref}\r\n%%EOF\r\n`);

  const total = chunks.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  chunks.forEach(b => { out.set(b, pos); pos += b.length; });
  const blob = new Blob([out], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `G-Records-Showroom-QR-Labels-A4-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
}

export { dimensionsFor, money };
