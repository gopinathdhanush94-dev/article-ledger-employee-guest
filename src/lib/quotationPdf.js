export function createQuotationRequestPdf({ orderNumber, customerName, customerEmail, items, comments, includePricing = false }) {
  // Dependency-free A4 PDF generator.  This intentionally contains customer-safe
  // request information only: no MRP, selling price, discounts or internal pricing.
  const encoder = new TextEncoder();
  const esc = value => String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/×/g, 'x')
    .replace(/₹/g, 'Rs')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
  const plain = value => String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/×/g, 'x')
    .replace(/₹/g, 'Rs')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
  const cleanName = item => {
    const candidates = [item?.description, item?.product_name, item?.name, item?.model, item?.article_no, item?.ean ? `Product ${item.ean}` : ''];
    return candidates.map(plain).find(v => v && !/^untitled(?: product)?$/i.test(v)) || 'Product';
  };
  const wrap = (value, width) => {
    const text = plain(value);
    if (!text) return [''];
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      if (!line) line = word;
      else if (`${line} ${word}`.length <= width) line += ` ${word}`;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
  };
  const fmtDate = value => {
    const raw = plain(value);
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : (raw || '-');
  };
  const fmtQty = n => Math.max(1, Number(n) || 1).toLocaleString('en-IN');
  const totalQty = items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
  const totalValue = items.reduce((sum, item) => sum + (Math.max(1, Number(item.quantity) || 1) * Math.max(0, Number(item.quoted_unit_price) || 0)), 0);
  const money = value => `Rs ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const W = 595, H = 842, M = 34, U = W - 2 * M;
  const ORANGE = [239, 82, 48], NAVY = [18, 30, 48], MUTED = [90, 106, 126], BORDER = [220, 226, 235], LIGHT = [247, 249, 252], LIGHT2 = [251, 252, 253];
  const pages = [];
  let ops = [];
  let pageNo = 1;
  let top = 0;
  const rgb = (c) => `${c[0] / 255} ${c[1] / 255} ${c[2] / 255}`;
  const y = t => H - t;
  const add = op => ops.push(op);
  const rect = (x, t, w, h, fill) => add(`q ${rgb(fill)} rg ${x} ${H - t - h} ${w} ${h} re f Q`);
  const line = (x1, t1, x2, t2, stroke=BORDER, width=.6) => add(`q ${width} w ${rgb(stroke)} RG ${x1} ${y(t1)} m ${x2} ${y(t2)} l S Q`);
  const text = (value, x, t, size=9, color=NAVY, font='F1') => add(`BT ${rgb(color)} rg /${font} ${size} Tf 1 0 0 1 ${x} ${y(t)} Tm (${esc(value)}) Tj ET`);
  const bold = (value, x, t, size=9, color=NAVY) => text(value, x, t, size, color, 'F2');
  const right = (value, xr, t, size=9, color=NAVY, font='F1') => { const v=plain(value); const approx=v.length*size*0.52; text(v, xr-approx, t, size, color, font); };
  const footer = () => { line(M, 804, W-M, 804); text(includePricing ? 'G-RECORDS  |  SHOWROOM QUOTATION' : 'G-RECORDS  |  SHOWROOM QUOTATION REQUEST', M, 819, 7.2, MUTED); right(`Page ${pageNo}`, W-M, 819, 7.2, MUTED); };
  function header(continuation=false) {
    rect(0, 0, W, continuation ? 56 : 96, LIGHT);
    rect(0, 0, 7, continuation ? 56 : 96, ORANGE);
    bold('G-RECORDS', M, 25, continuation ? 13 : 17, ORANGE);
    bold(continuation ? `SHOWROOM QUOTATION REQUEST - ${orderNumber}` : 'SHOWROOM QUOTATION REQUEST', M, continuation ? 43 : 48, continuation ? 8.5 : 11, MUTED);
    if (!continuation) {
      bold(includePricing ? 'QUOTATION' : 'REQUEST', W-M-112, 25, 8, MUTED);
      right(orderNumber, W-M-112+112, 44, 12, NAVY, 'F2');
      right(includePricing ? 'PRICED QUOTATION' : 'NON-PRICED CUSTOMER REQUEST', W-M, 65, 8, ORANGE, 'F2');
      top = 113;
    } else top = 72;
  }
  function pushPage() {
    footer();
    pages.push(ops.join('\n'));
    ops=[];
    pageNo += 1;
    header(true);
  }

  header(false);
  text('CUSTOMER DETAILS', M, top, 8.5, MUTED, 'F2');
  top += 9;
  rect(M, top, U, 45, LIGHT2);
  line(M, top+45, W-M, top+45);
  const mid = M + U/2;
  bold('CUSTOMER', M+10, top+14, 7.5, MUTED); text(customerName || 'Registered Guest', M+10, top+29, 10.2);
  bold('REGISTERED EMAIL', mid, top+14, 7.5, MUTED); text(customerEmail || '-', mid, top+29, 10.2);
  top += 63;
  text(includePricing ? 'QUOTATION DETAILS' : 'REQUESTED PRODUCTS', M, top, 8.5, MUTED, 'F2');
  top += 13;

  const cols = includePricing ? [
    {title:'S.NO', w:28, align:'center'},
    {title:'PRODUCT DESCRIPTION', w:196, align:'left'},
    {title:'EAN', w:82, align:'left'},
    {title:'QTY', w:42, align:'center'},
    {title:'REQUIRED', w:76, align:'center'},
    {title:'UNIT PRICE', w:56, align:'right'},
    {title:'LINE TOTAL', w:47, align:'right'},
  ] : [
    {title:'S.NO', w:32, align:'center'},
    {title:'PRODUCT DESCRIPTION', w:246, align:'left'},
    {title:'EAN', w:98, align:'left'},
    {title:'QTY', w:50, align:'center'},
    {title:'REQUIRED DATE', w:101, align:'center'},
  ];
  const xs=[M]; cols.forEach(c=>xs.push(xs[xs.length-1]+c.w));
  // Column widths intentionally total U (527pt) so the right edge never clips in A4.
  if (xs[xs.length-1] !== W - M) throw new Error('Quotation table columns exceed printable width');
  const tableHeader = () => {
    rect(M, top, U, 26, ORANGE);
    cols.forEach((c,i)=>{
      const x0=xs[i]; if(c.align==='center'){ const v=c.title; const approx=v.length*3.45; text(v, x0+c.w/2-approx, top+17, 7.4, [255,255,255], 'F2'); }
      else bold(c.title, x0+7, top+17, 7.4, [255,255,255]);
      if(i>0) line(x0, top, x0, top+26, [255,160,140], .5);
    });
    top += 26;
  };
  tableHeader();

  items.forEach((item, idx) => {
    const nameLines = wrap(cleanName(item), 30);
    const rowH = Math.max(38, 16 + nameLines.length * 12);
    if (top + rowH > 780) { pushPage(); tableHeader(); }
    if (idx % 2 === 1) rect(M, top, U, rowH, LIGHT2);
    line(M, top+rowH, W-M, top+rowH);
    for(let i=1;i<cols.length;i++) line(xs[i], top, xs[i], top+rowH);
    text(String(idx+1), xs[0]+14, top+rowH/2+3, 9.2);
    nameLines.forEach((ln,li)=>text(ln, xs[1]+7, top+16+li*12, 9.1));
    text(plain(item.ean || '-'), xs[2]+7, top+rowH/2+3, 8.5, MUTED);
    const q=fmtQty(item.quantity); const qApprox=q.length*4.6; bold(q, xs[3]+cols[3].w/2-qApprox, top+rowH/2+3, 9.1);
    const d=fmtDate(item.requiredDate || item.required_date);
    if (includePricing) {
      right(d, xs[4]+cols[4].w-7, top+rowH/2+3, 7.8, MUTED);
      right(money(item.quoted_unit_price), xs[5]+cols[5].w-6, top+rowH/2+3, 7.4, NAVY, 'F2');
      const lineTotal = Math.max(1, Number(item.quantity) || 1) * Math.max(0, Number(item.quoted_unit_price) || 0);
      right(money(lineTotal), xs[6]+cols[6].w-6, top+rowH/2+3, 7.2, NAVY, 'F2');
    } else {
      right(d, xs[4]+cols[4].w-7, top+rowH/2+3, 8.2, MUTED);
    }
    top += rowH;
  });

  if (top + 150 > 780) pushPage();
  top += 14;
  rect(M, top, U, 44, LIGHT);
  bold('TOTAL PRODUCTS', M+12, top+17, 7.8, MUTED); bold(String(items.length), M+12, top+34, 11);
  bold('TOTAL QUANTITY', M+170, top+17, 7.8, MUTED); bold(fmtQty(totalQty), M+170, top+34, 11);
  if (includePricing) { bold('TOTAL VALUE', M+335, top+17, 7.8, MUTED); right(money(totalValue), W-M-12, top+34, 11, NAVY, 'F2'); }
  top += 61;

  text('CUSTOMER COMMENTS', M, top, 8.5, MUTED, 'F2');
  top += 9;
  const commentLines = wrap(comments || '-', 91).slice(0, 10);
  const commentH = Math.max(50, commentLines.length*12+22);
  rect(M, top, U, commentH, LIGHT2);
  commentLines.forEach((ln, i)=>text(ln, M+10, top+18+i*12, 9.1, MUTED));
  top += commentH + 18;
  if (top + 60 > 780) pushPage();
  rect(M, top, U, 44, [255,247,243]);
  bold('NEXT STEP', M+10, top+16, 7.8, ORANGE);
  text(includePricing ? 'Pricing and availability confirmed by G-RECORDS Accounts.', M+10, top+32, 9, MUTED);
  footer();
  pages.push(ops.join('\n'));

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >> >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  const pageNums = pages.map((_,i)=>5+i*2);
  objects[1] = `<< /Type /Pages /Kids [${pageNums.map(n=>`${n} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  pages.forEach((stream,i)=>{
    const p=5+i*2, c=p+1;
    const streamBytes=encoder.encode(stream).length;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /ProcSet [/PDF /Text] /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${c} 0 R >>`);
    objects.push(`<< /Length ${streamBytes} >>\r\nstream\r\n${stream}\r\nendstream`);
  });
  let pdf='%PDF-1.4\r\n';
  const offsets=[0];
  objects.forEach((obj,i)=>{ offsets[i+1]=encoder.encode(pdf).length; pdf += `${i+1} 0 obj\r\n${obj}\r\nendobj\r\n`; });
  const xref=encoder.encode(pdf).length;
  pdf += `xref\r\n0 ${objects.length+1}\r\n0000000000 65535 f \r\n`;
  for(let i=1;i<=objects.length;i++) pdf += `${String(offsets[i]).padStart(10,'0')} 00000 n \r\n`;
  pdf += `trailer\r\n<< /Size ${objects.length+1} /Root 1 0 R >>\r\nstartxref\r\n${xref}\r\n%%EOF\r\n`;
  // Use a data URL rather than a short-lived Blob URL. This is more reliable in
  // Chromium/Edge when a download is triggered immediately after an async RPC.
  const bytes = encoder.encode(pdf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const dataUrl = `data:application/pdf;base64,${btoa(binary)}`;
  const a=document.createElement('a');
  a.href=dataUrl; a.download=`G-Records-${includePricing ? 'Quotation' : 'Quotation-Request'}-${plain(orderNumber)||'Request'}.pdf`; a.style.display='none';
  document.body.appendChild(a); a.click();
  setTimeout(()=>a.remove(), 3000);
}
