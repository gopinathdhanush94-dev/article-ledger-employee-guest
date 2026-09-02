export const MONTH_ORDER = ['DEC-25','JAN-26','FEB-26','MAR-26','APR-26','MAY-26','JUN-26','JUL-26'];
export const MONTH_LABEL = {
  'DEC-25':'Dec 2025','JAN-26':'Jan 2026','FEB-26':'Feb 2026','MAR-26':'Mar 2026',
  'APR-26':'Apr 2026','MAY-26':'May 2026','JUN-26':'Jun 2026','JUL-26':'Jul 2026'
};

const MONTH_ABBR_TO_NUM = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6, june:6,
  jul:7, july:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12,
};

// Parses a wide variety of month-label formats ("DEC-25", "Dec-25", "dec 2025",
// "2024_Articles", bare "2024", etc.) into a single sortable YYYYMM-style number,
// so months sort in true chronological order regardless of casing or source batch.
// Unparseable values sort last.
export function monthSortKey(raw) {
  if (!raw) return Infinity;
  const s = String(raw).trim().toLowerCase();

  let m = s.match(/^([a-z]{3,4})[\s\-_]?(\d{2,4})(?!\d)/);
  if (m && MONTH_ABBR_TO_NUM[m[1]]) {
    const mon = MONTH_ABBR_TO_NUM[m[1]];
    const yrPart = m[2].length === 4 ? parseInt(m[2], 10) : 2000 + parseInt(m[2], 10);
    return yrPart * 100 + mon;
  }

  m = s.match(/(20\d{2})/);
  if (m) return parseInt(m[1], 10) * 100;

  return Infinity;
}

// Pulls just the 4-digit year out of any month-ish value, for a standalone
// Year filter — independent of exactly which month within that year.
export function extractYear(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  const m = s.match(/^([a-z]{3,4})[\s\-_]?(\d{2,4})(?!\d)/);
  if (m && MONTH_ABBR_TO_NUM[m[1]]) {
    return m[2].length === 4 ? m[2] : String(2000 + parseInt(m[2], 10));
  }
  const y = s.match(/(20\d{2})/);
  return y ? y[1] : null;
}

export function yearOptions(rows) {
  const years = new Set();
  for (const r of rows) {
    const y = extractYear(r.month);
    if (y) years.add(y);
  }
  return [...years].sort((a, b) => b.localeCompare(a)); // most recent first
}

const MONTH_NUM_TO_ABBR = {1:'JAN',2:'FEB',3:'MAR',4:'APR',5:'MAY',6:'JUN',7:'JUL',8:'AUG',9:'SEP',10:'OCT',11:'NOV',12:'DEC'};

// Normalizes any recognizable "month + year" text ("Jul-26", "jul 2026", "JUL2026")
// into one canonical raw form ("JUL-26"), so the same month always gets stored
// identically no matter how it was typed or which entry path was used. Anything
// that isn't recognizable as a month+year is just trimmed/uppercased as-is.
export function normalizeMonthValue(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.toLowerCase().match(/^([a-z]{3,4})[\s\-_]?(\d{2,4})(?!\d)/);
  if (m && MONTH_ABBR_TO_NUM[m[1]]) {
    const mon = MONTH_ABBR_TO_NUM[m[1]];
    const yy = m[2].length === 4 ? m[2].slice(2) : m[2].padStart(2, '0');
    return `${MONTH_NUM_TO_ABBR[mon]}-${yy}`;
  }
  return s.toUpperCase();
}

// Formats any month-ish value into a consistent display label ("Jul 2026"),
// regardless of how it's actually stored/cased — so the same month always
// looks the same everywhere, even across records added through different
// paths (manual entry, bulk upload, older imports).
export function formatMonthLabel(raw) {
  if (!raw) return '—';
  const s = String(raw).trim();
  const m = s.toLowerCase().match(/^([a-z]{3,4})[\s\-_]?(\d{2,4})(?!\d)/);
  if (m && MONTH_ABBR_TO_NUM[m[1]]) {
    const mon = MONTH_ABBR_TO_NUM[m[1]];
    const yr = m[2].length === 4 ? parseInt(m[2], 10) : 2000 + parseInt(m[2], 10);
    const abbr = MONTH_NUM_TO_ABBR[mon];
    const pretty = abbr[0] + abbr.slice(1).toLowerCase();
    return `${pretty} ${yr}`;
  }
  const y = s.match(/(20\d{2})/);
  if (y) return y[1];
  return s;
}

export function fmtINR(n) {
  return n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function discountPct(mrp, sp) {
  if (!mrp || sp == null) return null;
  const pct = ((mrp - sp) / mrp) * 100;
  if (!isFinite(pct) || pct <= 0) return null;
  return Math.round(pct);
}

export function isValidEan(v) {
  return /^\d{13}$/.test(v);
}

const CATEGORY_ICON_RULES = [
  [/back\s*pack|beackpack/, '🎒'],
  [/trolley|sling\s*bag|hand\s*bag|shopping\s*bag|tote\s*bag|pouch/, '👜'],
  [/wallet|purse/, '👛'],
  [/bottle|sipper|flask|water\s*jug/, '🍶'],
  [/mug|cup|glass(?!es)/, '☕'],
  [/kitchen|cutter|slicer|grater|spatula|ladle|rolling\s*pin|chopping/, '🍳'],
  [/lunch\s*box|tiffin/, '🍱'],
  [/plate|bowl|dinner\s*set|crockery/, '🍽️'],
  [/jar|container|storage\s*box|organizer/, '🏺'],
  [/clock|watch/, '⏰'],
  [/lock|key\s*chain/, '🔒'],
  [/basket/, '🧺'],
  [/towel|napkin|tissue/, '🧻'],
  [/blanket|quilt|comforter/, '🛏️'],
  [/bedsheet|bed\s*sheet|pillow|cushion/, '🛌'],
  [/curtain/, '⬜'],
  [/mat(?!erial)|rug|carpet/, '🔲'],
  [/umbrella/, '☂️'],
  [/cap(?!acity)|hat/, '🧢'],
  [/sunglass|goggle/, '🕶️'],
  [/mirror/, '🔷'],
  [/hook|hanger|rack/, '📌'],
  [/mop|broom|clean|duster|brush(?!ush)/, '🧹'],
  [/soap|shampoo|body\s*wash/, '🧼'],
  [/perfume|deo|fragrance/, '🧴'],
  [/led|light|lamp|torch|bulb/, '💡'],
  [/stationary|stationery|pen(?!dant)|pencil|notebook|diary/, '✏️'],
  [/sticker|tape/, '📎'],
  [/nail\s*sticker|nail\s*art|beauty|cosmetic|makeup|make\s*up/, '💄'],
  [/dispenser|bottle\s*pump/, '🧴'],
  [/stapler|clip/, '📎'],
  [/bin|dustbin|trash/, '🗑️'],
  [/toy|game(?!s room)/, '🧸'],
  [/vase|planter|pot(?!tery)/, '🌱'],
  [/frame|photo/, '🖼️'],
  [/slipper|footwear|shoe|sandal/, '👟'],
  [/tray/, '🍽️'],
  [/gift\s*set|combo\s*set/, '🎁'],
];
export function categoryIcon(name) {
  const n = (name || '').toLowerCase();
  for (const [re, icon] of CATEGORY_ICON_RULES) if (re.test(n)) return icon;
  return '📦';
}

export function uniqueSorted(rows, key) {
  return [...new Set(rows.map(r => r[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

const GARMENT_TYPE_ICON_RULES = [
  [/jacket|puffer|coat/, '🧥'],
  [/track\s*pant|jogger|trouser|jegging|pant/, '👖'],
  [/short/, '🩳'],
  [/sweat\s*shirt|hoodie/, '👕'],
  [/t[-\s]?shirt|tee/, '👕'],
  [/^shirt$|\bshirt\b/, '👔'],
  [/vest/, '🎽'],
  [/dress|frock/, '👗'],
  [/skirt/, '👗'],
  [/top/, '👕'],
  [/velour|thermal|inner/, '🧦'],
  [/night\s*wear|nighty|pajama|pyjama/, '🌙'],
  [/co-?ord|combo\s*set|^set$/, '👚'],
  [/fleece|sweater|pullover/, '🧶'],
];
export function garmentTypeIcon(name) {
  const n = (name || '').toLowerCase();
  for (const [re, icon] of GARMENT_TYPE_ICON_RULES) if (re.test(n)) return icon;
  return '👕';
}

export function monthOptions(rows) {
  const seen = new Set();
  for (const r of rows) {
    const norm = normalizeMonthValue(r.month);
    if (norm) seen.add(norm);
  }
  return [...seen].sort((a, b) => monthSortKey(b) - monthSortKey(a)); // most recent first
}
