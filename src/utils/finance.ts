/**
 * TAMIMA centralized financial engine — single source of truth for parsing,
 * calculation and validation. Used by Import, Booking Detail, Dashboard,
 * Profitability, Export and Reports. No silent corrections: nulls stay null.
 */

export type Money = number | null;

const NULL_TOKENS = new Set(['', 'nan', 'n/a', 'na', '-', '—', '–', 'null', 'undefined', '.']);

/** Strip currency prefixes / thousands separators (ID & EN) → raw numeric string */
function rawNumber(v: unknown): string | null {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  if (v == null) return null;
  let s = String(v).trim().toLowerCase();
  if (NULL_TOKENS.has(s)) return null;
  s = s.replace(/sar|rp|idr|usd|\$/g, '').trim();
  if (NULL_TOKENS.has(s)) return null;
  // keep digits, dot, comma, minus
  s = s.replace(/[^0-9.,-]/g, '');
  if (!s || s === '-' || s === '.') return null;
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  if (dots && commas) {
    // both present → the one that appears last is the decimal separator
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) s = s.replace(/,/g, '');
    else s = s.replace(/\./g, '').replace(',', '.');
  } else if (dots > 1) {
    s = s.replace(/\./g, ''); // ID thousands: 76.597.400
  } else if (commas > 1) {
    s = s.replace(/,/g, '');
  } else if (commas === 1) {
    // single comma: decimal if ≤2 trailing digits, else thousands
    const [, after] = s.split(',');
    s = after.length <= 2 ? s.replace(',', '.') : s.replace(',', '');
  } else if (dots === 1) {
    const [, after] = s.split('.');
    if (after.length === 3 && s.length > 4) s = s.replace('.', ''); // 5.076.320 style already handled above; 1.234 → thousands
  }
  return s;
}

/**
 * Localized number parser with Excel date-corruption detection.
 * "Feb-50" style values are NOT coerced to numbers — flagged instead.
 */
export function parseLocalizedNumber(v: unknown): { value: Money; corruption: string | null } {
  if (v == null) return { value: null, corruption: null };
  if (typeof v === 'number') return { value: Math.round(v * 100) / 100, corruption: null };
  const s = String(v).trim();
  // Excel date-format corruption: "Feb-50", "Jan-26", "Dec-99"
  if (/^[A-Za-z]{3,9}-\d{1,4}$/.test(s) && isNaN(Date.parse(s)) === false) {
    return { value: null, corruption: `Possible Excel date-format corruption detected: "${s}"` };
  }
  if (/^[A-Za-z]{3,9}-\d{1,4}$/.test(s)) {
    return { value: null, corruption: `Possible Excel date-format corruption detected: "${s}"` };
  }
  return { value: parseMoney(v), corruption: null };
}

/** Decimal-safe money parse (rounded to 2 dp to avoid binary float drift) */
export function parseMoney(v: unknown): Money {
  const s = rawNumber(v);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/* ---------------- Status & room-type normalization ---------------- */

export function normalizeStatus(v: unknown): 'PAID' | 'PARTIAL' | 'UNPAID' | null {
  const s = String(v ?? '').toLowerCase().replace(/[^a-z\s]/g, '').trim();
  if (!s) return null;
  if (/(^|\s)(lunas|paid|full paid|settled)(\s|$)/.test(s) && !s.includes('belum')) return 'PAID';
  if (/(partial|sebagian|\bdp\b|deposit)/.test(s)) return 'PARTIAL';
  if (/(belum|unpaid|outstanding|belum bayar|pending)/.test(s)) return 'UNPAID';
  return null;
}

const ROOM_ALIASES: Record<string, RoomCode> = {
  dbl: 'DBL', double: 'DBL', dblroom: 'DBL', doubleroom: 'DBL', doublebed: 'DBL',
  trp: 'TRP', triple: 'TRP', trpl: 'TRP', tripleroom: 'TRP',
  qrd: 'QRD', quad: 'QRD', quadruple: 'QRD', quadroom: 'QRD',
  qnt: 'QNT', quint: 'QNT', quintuple: 'QNT', quintroom: 'QNT',
  bed: 'BED', bedonly: 'BED',
  ext: 'EXT', extra: 'EXT', extrabed: 'EXT', extension: 'EXT',
};
export function normalizeRoomType(v: unknown): RoomCode | null {
  const n = String(v ?? '').toLowerCase().replace(/[^a-z]+/g, '');
  if (ROOM_ALIASES[n]) return ROOM_ALIASES[n];
  const prefix = Object.keys(ROOM_ALIASES)
    .sort((a, b) => b.length - a.length)
    .find((alias) => n.startsWith(alias));
  return prefix ? ROOM_ALIASES[prefix] : null;
}

export function normalizeText(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}
export const normalizeVendor = normalizeText;
export const normalizeCustomer = normalizeText;
export function normalizeBookingNumber(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, '').toUpperCase();
}
export const parseSAR = parseMoney;
export const parseIDR = (v: unknown): Money => {
  const m = parseMoney(v);
  return m == null ? null : Math.round(m);
};
export function parsePercentage(v: unknown): Money {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  const s = String(v ?? '').replace(/[^0-9.,-]/g, '');
  const m = parseMoney(s);
  return m;
}
export function parseQuantity(v: unknown): number | null {
  const m = parseMoney(v);
  return m == null ? null : Math.round(m);
}
export const parseRate = parseMoney;

/** "5/430" → {qty, rate}; invalid tokens → nulls + warning flag */
export function parseQtyRate(v: unknown): { qty: number | null; rate: Money; invalid: boolean } {
  if (v == null) return { qty: null, rate: null, invalid: false };
  if (typeof v === 'number') return { qty: null, rate: null, invalid: true };
  const s = String(v).trim();
  if (NULL_TOKENS.has(s.toLowerCase())) return { qty: null, rate: null, invalid: false };
  const m = s.match(/^(\d+)\s*\/\s*([0-9.,]+)\s*(?:SAR)?$/i);
  if (!m) return { qty: null, rate: null, invalid: true };
  return { qty: parseInt(m[1], 10), rate: parseRate(m[2]), invalid: false };
}

/* ---------------- Indonesian & serial date parsing ---------------- */

const ID_MONTHS: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};
const EN_MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(+v)) return toISO(v);
  if (typeof v === 'number') {
    // Excel serial date (days since 1899-12-30)
    if (v > 20000 && v < 80000) return toISO(new Date(Math.round((v - 25569) * 86400 * 1000)));
    return null;
  }
  const s = String(v).trim();
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  // DD/MM/YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  // "12 September 2026" (ID or EN month names)
  m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const mo = ID_MONTHS[m[2].toLowerCase()] ?? EN_MONTHS[m[2].toLowerCase()];
    if (mo != null) return `${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  // "Sep 12, 2026" / "September 12 2026"
  m = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const mo = ID_MONTHS[m[1].toLowerCase()] ?? EN_MONTHS[m[1].toLowerCase()];
    if (mo != null) return `${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}
export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function nightsBetween(checkIn: string | null, checkOut: string | null): number | null {
  if (!checkIn || !checkOut) return null;
  const n = Math.round((+new Date(checkOut) - +new Date(checkIn)) / 86400000);
  return n > 0 ? n : null;
}

/* ---------------- Deterministic calculations ---------------- */

export type RoomCode = 'DBL' | 'TRP' | 'QRD' | 'QNT' | 'BED' | 'EXT';
export const ROOM_CODES: RoomCode[] = ['DBL', 'TRP', 'QRD', 'QNT', 'BED', 'EXT'];
export const ROOM_LABELS: Record<RoomCode, string> = {
  DBL: 'Double', TRP: 'Triple', QRD: 'Quad', QNT: 'Quint', BED: 'Bed', EXT: 'Extra',
};

export interface RoomLine { qty: number | null; rate: Money }
export interface SideTotals {
  rooms: Record<RoomCode, RoomLine>;
  meal: string | null;
  vat: Money;
  trans: Money;
  totalSAR: Money;
  idrMasuk: Money;
  sisaIDR: Money;
  totalIDRActual: Money;
}

/** Σ qty × rate across room lines (null-safe; nulls contribute 0 but are flagged elsewhere) */
export function calculateRoomTotal(side: Pick<SideTotals, 'rooms'>, nights = 1): number {
  return ROOM_CODES.reduce((sum, code) => {
    const l = side.rooms[code];
    if (!l || l.qty == null || l.rate == null) return sum;
    return Math.round((sum + l.qty * l.rate * nights) * 100) / 100;
  }, 0);
}

export function calculateBookingTotal(
  side: Pick<SideTotals, 'rooms' | 'vat' | 'trans'>,
  nights = 1
): number {
  return Math.round((calculateRoomTotal(side, nights) + (side.vat ?? 0) + (side.trans ?? 0)) * 100) / 100;
}

export function calculateProfit(sellActualIDR: Money, buyActualIDR: Money): Money {
  if (sellActualIDR == null || buyActualIDR == null) return null;
  return Math.round(sellActualIDR - buyActualIDR);
}
export function calculateMargin(profitIDR: Money, revenueIDR: Money): Money {
  if (profitIDR == null || revenueIDR == null || revenueIDR === 0) return null;
  return Math.round((profitIDR / revenueIDR) * 10000) / 100;
}

export interface Variance { source: Money; calculated: number; variance: number; ok: boolean }
export function validateFinancials(source: Money, calculated: number, tolerance: number): Variance {
  const src = source ?? 0;
  const variance = Math.round((src - calculated) * 100) / 100;
  return { source: source, calculated, variance, ok: source != null && Math.abs(variance) <= tolerance };
}

/* ---------------- Header normalization & alias mapping ---------------- */

export function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '') // strips spaces, slashes, underscores, punctuation
    .trim();
}

const HEADER_ALIASES: Record<string, string> = {
  dblqr: 'dbl_qr', dblq: 'dbl_qty', dblrate: 'dbl_rate', dbl: 'dbl_qr',
  trpqr: 'trp_qr', trpq: 'trp_qty', trprate: 'trp_rate', trp: 'trp_qr',
  qrdqr: 'qrd_qr', qrdq: 'qrd_qty', qrdrate: 'qrd_rate', qrd: 'qrd_qr',
  qntqr: 'qnt_qr', qntq: 'qnt_qty', qntrate: 'qnt_rate', qnt: 'qnt_qr',
  bedqr: 'bed_qr', bedq: 'bed_qty', bedrate: 'bed_rate', bed: 'bed_qr',
  extqr: 'ext_qr', extq: 'ext_qty', extrate: 'ext_rate', ext: 'ext_qr',
  meal: 'meal', mealplan: 'meal', vat: 'vat', trans: 'trans', transport: 'trans',
  totalsar: 'total_sar', totaltagihansar: 'total_sar',
  idrmasuk: 'idr_masuk', sisaidr: 'sisa_idr', totalidraktual: 'total_idr', totalidr: 'total_idr',
  type: 'type', totalnight: 'nights', total: 'nights', night: 'nights',
  checkin: 'check_in', checkindate: 'check_in', checkout: 'check_out', checkoutdate: 'check_out',
  startdate: 'check_in', arrival: 'check_in', tanggalmasuk: 'check_in',
  enddate: 'check_out', departure: 'check_out', tanggalkeluar: 'check_out',
  hotel: 'hotel', hotelname: 'hotel', namahotel: 'hotel', property: 'hotel', accommodation: 'hotel',
  customer: 'customer', customername: 'customer', travelname: 'customer', travel: 'customer',
  travelagent: 'customer', client: 'customer', guest: 'customer', guestname: 'customer',
  vendor: 'vendor', supplier: 'vendor', hotelvendor: 'vendor', vendorname: 'vendor',
  pic: 'pic', picinternal: 'pic', contact: 'pic', picname: 'pic',
  sales: 'sales', salesperson: 'sales', marketing: 'sales', handledby: 'sales', salesname: 'sales',
  periode: 'periode', period: 'periode', status: 'status', paymentstatus: 'status', bookingstatus: 'status',
  netprofitidr: 'net_profit', netprofit: 'net_profit', netmargin: 'net_profit', margin: 'margin',
  profit: 'net_profit', marginpercentage: 'margin', netprofitmargin: 'margin',
  netprofitmarginpct: 'margin', netprofitmarginpercentage: 'margin',
  pembayaran1idr: 'pay1_idr', pembayaran1kurs: 'pay1_kurs',
  bookingno: 'booking_no', bookingnumber: 'booking_no', bookingid: 'booking_no',
  nobooking: 'booking_no', reference: 'booking_no', ref: 'booking_no',
  currency: 'currency', exchangerate: 'exchange_rate', kurs: 'exchange_rate', notes: 'notes',
};

export function mapHeader(h: unknown): string | null {
  const n = normalizeHeader(h);
  return HEADER_ALIASES[n] ?? null;
}
