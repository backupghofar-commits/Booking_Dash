import * as XLSX from 'xlsx';
import {
  parseMoney, parseIDR, parsePercentage, parseQtyRate, parseDate, nightsBetween,
  normalizeHeader, mapHeader, calculateRoomTotal, calculateBookingTotal, calculateProfit,
  calculateMargin, validateFinancials, normalizeStatus, parseLocalizedNumber,
  ROOM_CODES, ROOM_LABELS,
  type RoomCode, type RoomLine, type Money,
} from './finance';
import { extractPdfTables } from './pdfImport';

export type IssueLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export interface Issue { level: IssueLevel; msg: string }
export interface AuditField {
  label: string;
  source: string;
  normalized: string;
  calculated?: string;
  variance?: string;
  status: 'VALID' | 'WARNING' | 'ERROR';
}
export type BookingVerdict = 'VALID' | 'WARNING' | 'ERROR' | 'DUPLICATE';

export interface MasterSide {
  rooms: Record<RoomCode, RoomLine>;
  meal: string | null;
  vat: Money; trans: Money;
  totalSAR: Money; idrMasuk: Money; sisaIDR: Money; totalIDRActual: Money;
}

export interface MasterBooking {
  bookingNo: string;
  hotel: string | null; customer: string | null; vendor: string | null;
  pic: string | null; sales: string | null;
  checkIn: string | null; checkOut: string | null;
  sourceNights: number | null; calcNights: number | null;
  status: string | null;
  buy: MasterSide; sell: MasterSide;
  netProfitIDR: Money; marginPct: Money;
  currency: string | null;
  exchangeRate: Money;
  notes: string | null;
  verdict: BookingVerdict;
  issues: Issue[];
  fields: AuditField[];
  dupOfExisting: string | null;
  dupOfFile: string | null;
  quality: number;
}

export interface MasterImportResult {
  fileKind: string;
  rowsDetected: number;
  bookings: MasterBooking[];
  counts: { valid: number; warning: number; error: number; duplicate: number; mismatches: number };
  critical: Issue[];
}

/* ---------------- File sniffing (never trust the extension) ---------------- */

export function sniffFile(buf: ArrayBuffer): 'xlsx' | 'html' | 'csv' | 'xls' | 'unknown' {
  const bytes = new Uint8Array(buf.slice(0, 8));
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'xlsx'; // PK zip
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) return 'xls'; // OLE2 compound
  const head = new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, 2048)).toLowerCase();
  if (head.includes('<html') || head.includes('<table') || head.includes('<!doctype')) return 'html';
  if (/^[\s]*[^<\s][^<]*$/m.test(head) && /[,;\t]/.test(head)) return 'csv';
  return 'unknown';
}

/** HTML-in-.xls fallback: extract <table> cells into aoa */
function htmlToAoa(buf: ArrayBuffer): unknown[][] {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return [];
  const grid: string[][] = [];
  Array.from(table.querySelectorAll('tr')).forEach((tr, rowIndex) => {
    if (!grid[rowIndex]) grid[rowIndex] = [];
    let columnIndex = 0;
    Array.from(tr.querySelectorAll('th,td')).forEach((cell) => {
      while (grid[rowIndex][columnIndex] !== undefined) columnIndex++;
      const value = (cell.textContent || '').trim();
      const colspan = Math.max(1, Number(cell.getAttribute('colspan')) || 1);
      const rowspan = Math.max(1, Number(cell.getAttribute('rowspan')) || 1);
      for (let rowOffset = 0; rowOffset < rowspan; rowOffset++) {
        const targetRow = rowIndex + rowOffset;
        if (!grid[targetRow]) grid[targetRow] = [];
        for (let colOffset = 0; colOffset < colspan; colOffset++) {
          grid[targetRow][columnIndex + colOffset] = rowOffset === 0 && colOffset === 0 ? value : '';
        }
      }
      columnIndex += colspan;
    });
  });
  return grid;
}

export async function readWorkbook(buf: ArrayBuffer): Promise<{ aoa: unknown[][]; kind: string }> {
  const kind = sniffFile(buf);
  if (kind === 'html') return { aoa: htmlToAoa(buf), kind: 'legacy HTML-in-.xls' };
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][];
  return { aoa, kind: kind === 'xlsx' ? 'XLSX' : kind === 'xls' ? 'binary XLS' : kind === 'csv' ? 'CSV' : 'auto-detected' };
}

/* ---------------- Side parsing ---------------- */

const emptySide = (): MasterSide => ({
  rooms: Object.fromEntries(ROOM_CODES.map((c) => [c, { qty: null, rate: null }])) as Record<RoomCode, RoomLine>,
  meal: null, vat: null, trans: null, totalSAR: null, idrMasuk: null, sisaIDR: null, totalIDRActual: null,
});

function parseSide(row: unknown[], col: Record<string, number>, issues: Issue[], tag: 'BUY' | 'SELL'): MasterSide {
  const side = emptySide();
  ROOM_CODES.forEach((code) => {
    const qrIdx = col[`${code.toLowerCase()}_qr`];
    const qIdx = col[`${code.toLowerCase()}_qty`];
    const rIdx = col[`${code.toLowerCase()}_rate`];
    if (qrIdx != null && qrIdx >= 0) {
      const loc = parseLocalizedNumber(row[qrIdx]);
      if (loc.corruption) issues.push({ level: 'WARNING', msg: `${tag} ${code} Q/R — ${loc.corruption}` });
      const { qty, rate, invalid } = parseQtyRate(row[qrIdx]);
      if (invalid) issues.push({ level: 'ERROR', msg: `${tag} ${code} Q/R: invalid value "${row[qrIdx]}" — set to null` });
      side.rooms[code] = { qty, rate };
    } else if (qIdx != null && qIdx >= 0) {
      side.rooms[code] = { qty: parseMoney(row[qIdx]) != null ? Math.round(parseMoney(row[qIdx])!) : null, rate: rIdx != null && rIdx >= 0 ? parseMoney(row[rIdx]) : null };
    }
  });
  const g = (k: string) => (col[k] != null && col[k] >= 0 ? row[col[k]] : undefined);
  const mealRaw = g('meal');
  side.meal = mealRaw == null || String(mealRaw).trim() === '' ? null : String(mealRaw).trim();
  side.vat = parseMoney(g('vat'));
  side.trans = parseMoney(g('trans'));
  side.totalSAR = parseMoney(g('total_sar'));
  side.idrMasuk = parseIDR(g('idr_masuk'));
  side.sisaIDR = parseIDR(g('sisa_idr'));
  side.totalIDRActual = parseIDR(g('total_idr'));
  return side;
}

/* ---------------- Metadata extraction ---------------- */

function extractMeta(cells: unknown[]): Record<string, string> {
  const out: Record<string, string> = {};
  const push = (key: string, val: unknown) => {
    const s = String(val ?? '').trim();
    if (s && !out[key]) out[key] = s;
  };
  // pipe-joined single cell format
  const joined = cells.map((c) => String(c ?? '').trim()).join('|');
  if (/booking\s*#/i.test(joined)) {
    const grab = (re: RegExp) => { const m = joined.match(re); return m ? m[1].trim() : ''; };
    push('hotel', grab(/Hotel:\s*([^|]*)/i));
    push('customer', grab(/(?:Customer|Travel\s*Name|Client):\s*([^|]*)/i));
    push('vendor', grab(/Vendor:\s*([^|]*)/i));
    push('pic', grab(/PIC(?:\s*Internal)?:\s*([^|]*)/i));
    push('sales', grab(/(?:Sales|Sales\s*Person):\s*([^|]*)/i));
    push('periode', grab(/Periode:\s*([^|]*)/i));
    push('status', grab(/Status:\s*([^|]*)/i));
    push('net_profit', grab(/NET\s*PROFIT:\s*IDR\s*([0-9.,-]*)/i));
    const pct = joined.match(/\(([0-9.,]+)\s*%\)/);
    if (pct) push('margin', pct[1]);
  }
  // separate-cell label:value pairs
  cells.forEach((c, i) => {
    const key = mapHeader(c);
    if (key && cells[i + 1] !== undefined) push(key, cells[i + 1]);
  });
  return out;
}

interface AuditInput {
  bookingNo: string;
  hotel: string | null;
  customer: string | null;
  vendor: string | null;
  pic: string | null;
  sales: string | null;
  checkIn: string | null;
  checkOut: string | null;
  sourceNights: number | null;
  status: string | null;
  buy: MasterSide;
  sell: MasterSide;
  sourceProfit: Money;
  sourceMargin: Money;
  currency?: string | null;
  exchangeRate?: Money;
  notes?: string | null;
  issues: Issue[];
  existingNorm: Set<string>;
  seenInFile: Map<string, number>;
  tolerance: number;
}

/** One audit path shared by legacy block and canonical one-row imports. */
function auditMasterBooking(input: AuditInput): MasterBooking {
  const {
    bookingNo, hotel, customer, vendor, pic, sales, checkIn, checkOut,
    sourceNights, status, buy, sell, sourceProfit, sourceMargin,
    currency = null, exchangeRate = null, notes = null,
    issues, existingNorm, seenInFile, tolerance,
  } = input;
  const calcNights = nightsBetween(checkIn, checkOut);
  if (!checkIn || !checkOut) issues.push({ level: 'ERROR', msg: 'Invalid or missing check-in/check-out date' });
  if (sourceNights != null && calcNights != null && sourceNights !== calcNights) {
    issues.push({ level: 'WARNING', msg: `DATE_DURATION_MISMATCH — source ${sourceNights} vs calculated ${calcNights} (Δ${calcNights - sourceNights})` });
  }
  const nights = sourceNights ?? calcNights ?? 1;
  const fields: AuditField[] = [];

  (['BUY', 'SELL'] as const).forEach((tag) => {
    const side = tag === 'BUY' ? buy : sell;
    const calcRooms = calculateRoomTotal(side, nights);
    const calcTotal = calculateBookingTotal(side, nights);
    const totalAudit = validateFinancials(side.totalSAR, calcTotal, tolerance);
    fields.push({
      label: `${tag} Total SAR`,
      source: side.totalSAR != null ? `${side.totalSAR.toLocaleString('id-ID')} SAR` : '—',
      normalized: side.totalSAR != null ? String(side.totalSAR) : 'null',
      calculated: `${calcTotal.toLocaleString('id-ID')} SAR`,
      variance: `${totalAudit.variance.toLocaleString('id-ID')} SAR`,
      status: side.totalSAR == null ? 'WARNING' : totalAudit.ok ? 'VALID' : 'WARNING',
    });
    if (!totalAudit.ok && side.totalSAR != null) {
      issues.push({
        level: 'WARNING',
        msg: `CALCULATION_MISMATCH ${tag}: source ${side.totalSAR} vs calculated ${calcTotal} (variance ${totalAudit.variance})`,
      });
    }
    if (
      calcRooms === 0 &&
      !ROOM_CODES.some((code) => (side.rooms[code].qty ?? 0) > 0) &&
      tag === 'SELL'
    ) {
      issues.push({ level: 'WARNING', msg: 'SELL has no room quantities — verify source' });
    }

    if (side.idrMasuk != null || side.sisaIDR != null || side.totalIDRActual != null) {
      const calculatedIDR = (side.idrMasuk ?? 0) + (side.sisaIDR ?? 0);
      const idrAudit = validateFinancials(side.totalIDRActual, calculatedIDR, Math.max(tolerance, 1));
      fields.push({
        label: `${tag} IDR (Masuk + Sisa = Aktual)`,
        source: side.totalIDRActual != null ? side.totalIDRActual.toLocaleString('id-ID') : '—',
        normalized: String(side.totalIDRActual ?? 'null'),
        calculated: calculatedIDR.toLocaleString('id-ID'),
        variance: idrAudit.variance.toLocaleString('id-ID'),
        status: idrAudit.ok ? 'VALID' : 'WARNING',
      });
      if (!idrAudit.ok) {
        issues.push({
          level: 'WARNING',
          msg: `PAYMENT_RECONCILIATION_WARNING ${tag}: IDR Masuk + Sisa ≠ Total IDR Aktual (Δ${idrAudit.variance})`,
        });
      }
    }
    if (side.sisaIDR != null && side.sisaIDR < 0) {
      issues.push({
        level: 'INFO',
        msg: `${tag} Sisa IDR negative (${side.sisaIDR.toLocaleString('id-ID')}) → OVERPAYMENT / CREDIT`,
      });
    }
  });

  const calculatedProfit = calculateProfit(sell.totalIDRActual, buy.totalIDRActual);
  if (sourceProfit != null && calculatedProfit != null) {
    const profitAudit = validateFinancials(sourceProfit, calculatedProfit, Math.max(tolerance, 1));
    fields.push({
      label: 'Net Profit IDR',
      source: sourceProfit.toLocaleString('id-ID'),
      normalized: String(sourceProfit),
      calculated: calculatedProfit.toLocaleString('id-ID'),
      variance: profitAudit.variance.toLocaleString('id-ID'),
      status: profitAudit.ok ? 'VALID' : 'WARNING',
    });
    if (!profitAudit.ok) {
      issues.push({
        level: 'WARNING',
        msg: `PROFITABILITY REVIEW REQUIRED — source ${sourceProfit} vs calculated ${calculatedProfit}`,
      });
    }
  }
  const calculatedMargin = calculateMargin(calculatedProfit, sell.totalIDRActual);
  if (sourceMargin != null && calculatedMargin != null) {
    const diff = Math.round((sourceMargin - calculatedMargin) * 100) / 100;
    fields.push({
      label: 'Net Profit Margin %',
      source: `${sourceMargin}%`,
      normalized: String(sourceMargin),
      calculated: `${calculatedMargin}%`,
      variance: `${diff}%`,
      status: Math.abs(diff) <= 0.01 ? 'VALID' : 'WARNING',
    });
    if (Math.abs(diff) > 0.01) {
      issues.push({ level: 'WARNING', msg: `PROFITABILITY REVIEW REQUIRED — margin source ${sourceMargin}% vs calculated ${calculatedMargin}%` });
    }
  }

  const normalizedNo = bookingNo.toLowerCase();
  const dupOfFile = seenInFile.has(normalizedNo) ? bookingNo : null;
  if (!dupOfFile) seenInFile.set(normalizedNo, seenInFile.size);
  const dupOfExisting = existingNorm.has(normalizedNo) ? bookingNo : null;
  const hasError = issues.some((issue) => issue.level === 'ERROR' || issue.level === 'CRITICAL');
  const verdict: BookingVerdict =
    dupOfExisting || dupOfFile
      ? 'DUPLICATE'
      : hasError
        ? 'ERROR'
        : issues.some((issue) => issue.level === 'WARNING')
          ? 'WARNING'
          : 'VALID';

  const booking: MasterBooking = {
    bookingNo, hotel, customer, vendor, pic, sales, checkIn, checkOut,
    sourceNights, calcNights, status, buy, sell,
    netProfitIDR: sourceProfit, marginPct: sourceMargin,
    currency, exchangeRate, notes,
    verdict, issues, fields, dupOfExisting, dupOfFile, quality: 0,
  };
  booking.quality = qualityScore(booking);
  return booking;
}

function canonicalHeaderKey(value: unknown): string | null {
  const normalized = normalizeHeader(value);
  const direct = mapHeader(value);
  if (direct) return direct;
  const sideMatch = normalized.match(
    /^(buy|sell)(dbl|double|trp|triple|qrd|quad|qnt|quint|quintuple|bed|ext|extra|extrabed)(qr|q|qty|rate)$/
  );
  if (sideMatch) {
    const suffix = sideMatch[3] === 'qr' ? 'qr' : sideMatch[3] === 'rate' ? 'rate' : 'qty';
    const roomAliases: Record<string, string> = {
      dbl: 'dbl', double: 'dbl', trp: 'trp', triple: 'trp',
      qrd: 'qrd', quad: 'qrd', qnt: 'qnt', quint: 'qnt', quintuple: 'qnt',
      bed: 'bed', ext: 'ext', extra: 'ext', extrabed: 'ext',
    };
    return `${sideMatch[1]}_${roomAliases[sideMatch[2]]}_${suffix}`;
  }
  const scalarMatch = normalized.match(
    /^(buy|sell)(meal|vat|trans|transport|transaction|totalsar|totaltagihansar|idrmasuk|idrpaid|idrreceived|sisaidr|idroutstanding|totalidr|totalidraktual|actualidr)$/
  );
  if (!scalarMatch) return null;
  const aliases: Record<string, string> = {
    meal: 'meal', vat: 'vat', trans: 'trans', transport: 'trans', transaction: 'trans',
    totalsar: 'total_sar', totaltagihansar: 'total_sar',
    idrmasuk: 'idr_masuk', idrpaid: 'idr_masuk', idrreceived: 'idr_masuk',
    sisaidr: 'sisa_idr', idroutstanding: 'sisa_idr',
    totalidr: 'total_idr', totalidraktual: 'total_idr', actualidr: 'total_idr',
  };
  return `${scalarMatch[1]}_${aliases[scalarMatch[2]]}`;
}

function parseCanonicalRows(
  aoa: unknown[][],
  existingNorm: Set<string>,
  tolerance: number
): MasterBooking[] {
  const headerIndex = aoa.findIndex((row) => {
    const keys = row.map(canonicalHeaderKey);
    return keys.includes('booking_no') && keys.some((key) => key === 'buy_dbl_qr' || key === 'buy_dbl_qty');
  });
  if (headerIndex < 0) return [];

  const column: Record<string, number> = {};
  aoa[headerIndex].forEach((value, index) => {
    const key = canonicalHeaderKey(value);
    if (key && column[key] == null) column[key] = index;
  });
  const seen = new Map<string, number>();
  const records: MasterBooking[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < aoa.length; rowIndex++) {
    const row = aoa[rowIndex];
    const get = (key: string) => (column[key] != null ? row[column[key]] : undefined);
    const bookingNo = String(get('booking_no') ?? '').trim();
    if (!bookingNo) continue;

    const issues: Issue[] = [];
    const parseCanonicalSide = (tag: 'buy' | 'sell'): MasterSide => {
      const genericColumns: Record<string, number> = {};
      Object.entries(column).forEach(([key, index]) => {
        if (key.startsWith(`${tag}_`)) genericColumns[key.slice(tag.length + 1)] = index;
      });
      return parseSide(row, genericColumns, issues, tag.toUpperCase() as 'BUY' | 'SELL');
    };
    const buy = parseCanonicalSide('buy');
    const sell = parseCanonicalSide('sell');
    const hotel = String(get('hotel') ?? '').trim() || null;
    const customer = String(get('customer') ?? '').trim() || null;
    const checkIn = parseDate(get('check_in'));
    const checkOut = parseDate(get('check_out'));
    const sourceNightsValue = parseMoney(get('nights'));
    const sourceNights = sourceNightsValue == null ? null : Math.round(sourceNightsValue);
    if (!hotel) issues.push({ level: 'ERROR', msg: 'Missing required hotel name' });
    if (!customer) issues.push({ level: 'ERROR', msg: 'Missing required customer name' });

    records.push(
      auditMasterBooking({
        bookingNo,
        hotel,
        customer,
        vendor: String(get('vendor') ?? '').trim() || null,
        pic: String(get('pic') ?? '').trim() || null,
        sales: String(get('sales') ?? '').trim() || null,
        checkIn,
        checkOut,
        sourceNights,
        status: String(get('status') ?? '').trim() || null,
        buy,
        sell,
        sourceProfit: parseIDR(get('net_profit')),
        sourceMargin: parsePercentage(get('margin')),
        currency: String(get('currency') ?? '').trim() || null,
        exchangeRate: parseMoney(get('exchange_rate')),
        notes: String(get('notes') ?? '').trim() || null,
        issues,
        existingNorm,
        seenInFile: seen,
        tolerance,
      })
    );
  }
  return records;
}

/* ---------------- Master parser ---------------- */

export function parseMaster(
  aoa: unknown[][],
  existingRefs: string[],
  tolerance: number
): MasterImportResult {
  const bookings: MasterBooking[] = [];
  const critical: Issue[] = [];
  const seenInFile = new Map<string, number>();
  const existingNorm = new Set(existingRefs.map((r) => r.toLowerCase()));

  const rowsDetected = aoa.reduce((n, r) => n + (r.some((c) => String(c ?? '').trim() !== '') ? 1 : 0), 0);

  const canonicalBookings = parseCanonicalRows(aoa, existingNorm, tolerance);
  if (canonicalBookings.length > 0) {
    return {
      fileKind: '',
      rowsDetected,
      bookings: canonicalBookings,
      counts: {
        valid: canonicalBookings.filter((b) => b.verdict === 'VALID').length,
        warning: canonicalBookings.filter((b) => b.verdict === 'WARNING').length,
        error: canonicalBookings.filter((b) => b.verdict === 'ERROR').length,
        duplicate: canonicalBookings.filter((b) => b.verdict === 'DUPLICATE').length,
        mismatches: canonicalBookings.reduce(
          (count, b) => count + b.issues.filter((issue) => issue.level === 'WARNING').length,
          0
        ),
      },
      critical,
    };
  }

  for (let i = 0; i < aoa.length; i++) {
    const cells = aoa[i];
    const joined = cells.map((c) => String(c ?? '').trim()).join('|');

    // ---- canonical one-row-per-booking: header detected earlier? handle via header scan below
    // ---- block format: BOOKING #N header row
    const bm = joined.match(/BOOKING\s*#?\s*(\d+)/i);
    if (!bm) continue;
    const bookingNo = `#${bm[1]}`;

    const meta = extractMeta(cells);

    // find column header row + BUY/SELL rows
    let hdrIdx = -1;
    for (let j = i + 1; j < Math.min(i + 5, aoa.length); j++) {
      const first = normalizeHeader(aoa[j][0]);
      if (first === 'type' || aoa[j].some((c) => mapHeader(c) === 'dbl_qr' || mapHeader(c) === 'dbl_qty')) { hdrIdx = j; break; }
    }
    if (hdrIdx < 0) { critical.push({ level: 'CRITICAL', msg: `Booking ${bookingNo}: column header row not found` }); continue; }

    const col: Record<string, number> = {};
    aoa[hdrIdx].forEach((h, idx) => { const k = mapHeader(h); if (k && col[k] == null) col[k] = idx; });

    const findRow = (tag: string) => {
      for (let j = hdrIdx + 1; j < Math.min(hdrIdx + 5, aoa.length); j++) {
        if (normalizeHeader(aoa[j][0]) === tag.toLowerCase()) return aoa[j];
      }
      return null;
    };
    const buyRow = findRow('BUY');
    const sellRow = findRow('SELL');
    if (!buyRow || !sellRow) { critical.push({ level: 'CRITICAL', msg: `Booking ${bookingNo}: broken BUY/SELL structure` }); continue; }

    const issues: Issue[] = [];
    const buy = parseSide(buyRow, col, issues, 'BUY');
    const sell = parseSide(sellRow, col, issues, 'SELL');

    // dates: from dedicated columns or periode text
    let checkIn = parseDate(col['check_in'] != null ? buyRow[col['check_in']] : null)
      || parseDate(col['check_in'] != null ? sellRow[col['check_in']] : null);
    let checkOut = parseDate(col['check_out'] != null ? buyRow[col['check_out']] : null)
      || parseDate(col['check_out'] != null ? sellRow[col['check_out']] : null);
    if ((!checkIn || !checkOut) && meta.periode) {
      const dm = meta.periode.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{4})/g) || [];
      checkIn = checkIn || parseDate(dm[0]);
      checkOut = checkOut || parseDate(dm[1]);
    }
    if (!checkIn || !checkOut) issues.push({ level: 'ERROR', msg: 'Invalid or missing check-in/check-out date' });

    const srcNightMatch = (meta.periode || joined).match(/\((\d+)\s*M\)/i);
    const sourceNights = srcNightMatch ? parseInt(srcNightMatch[1], 10) : (col['nights'] != null && col['nights'] >= 0 ? (parseMoney(buyRow[col['nights']]) != null ? Math.round(parseMoney(buyRow[col['nights']])!) : null) : null);
    const srcProfit = parseIDR(meta.net_profit);
    bookings.push(
      auditMasterBooking({
        bookingNo,
        hotel: meta.hotel || null,
        customer: meta.customer || null,
        vendor: meta.vendor || null,
        pic: meta.pic || null,
        sales: meta.sales || null,
        checkIn,
        checkOut,
        sourceNights,
        status: meta.status || null,
        buy,
        sell,
        sourceProfit: srcProfit,
        sourceMargin: parsePercentage(meta.margin),
        currency: null,
        exchangeRate: null,
        notes: null,
        issues,
        existingNorm,
        seenInFile,
        tolerance,
      })
    );
  }

  const counts = {
    valid: bookings.filter((b) => b.verdict === 'VALID').length,
    warning: bookings.filter((b) => b.verdict === 'WARNING').length,
    error: bookings.filter((b) => b.verdict === 'ERROR').length,
    duplicate: bookings.filter((b) => b.verdict === 'DUPLICATE').length,
    mismatches: bookings.reduce((n, b) => n + b.issues.filter((x) => x.level === 'WARNING').length, 0),
  };

  return { fileKind: '', rowsDetected, bookings, counts, critical };
}

/* ---------------- Universal file reader (xlsx / xls binary / xls-HTML / csv / pdf) ---------------- */

export interface AnyFileResult {
  aoa: unknown[][];
  kind: string;
  sheets: number;
  pdf?: { pages: number; textLength: number; scanned: boolean; tables: number };
}

export async function readAnyFile(buf: ArrayBuffer): Promise<AnyFileResult> {
  const head = new Uint8Array(buf.slice(0, 5));
  // PDF signature %PDF-
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) {
    const res = await extractPdfTables(buf);
    if (res.scanned) return { aoa: [], kind: 'PDF (scanned image)', sheets: res.pages, pdf: { ...res, tables: 0 } };
    return { aoa: res.rows, kind: 'PDF (text table)', sheets: res.pages, pdf: { ...res, tables: res.rows.length } };
  }
  const { aoa, kind } = await readWorkbook(buf);
  // multi-sheet: also scan remaining sheets for additional booking blocks
  if (kind !== 'legacy HTML-in-.xls') {
    try {
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      if (wb.SheetNames.length > 1) {
        const extra: unknown[][] = [];
        wb.SheetNames.slice(1).forEach((name) => {
          const ws = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][];
          if (
            rows.some((r) => /BOOKING\s*#/i.test(r.map((c) => String(c ?? '')).join('|'))) ||
            rows.some((r) => {
              const normalized = r.map((c) => normalizeHeader(c));
              return normalized.includes('bookingnumber') && normalized.some((h) => h === 'buydoubleqty');
            })
          ) {
            extra.push([], ...rows);
          }
        });
        return { aoa: [...aoa, ...extra], kind: `${kind} · ${wb.SheetNames.length} sheets`, sheets: wb.SheetNames.length };
      }
      return { aoa, kind, sheets: 1 };
    } catch {
      return { aoa, kind, sheets: 1 };
    }
  }
  return { aoa, kind, sheets: 1 };
}

/* ---------------- Report summary extraction & reconciliation ---------------- */

export interface ReportSummary {
  modalIDR: number | null; revenueIDR: number | null; netProfitIDR: number | null;
  diterimaIDR: number | null; sisaIDR: number | null; bookingCount: number | null;
}

export function extractSummary(aoa: unknown[][]): ReportSummary {
  const sum: ReportSummary = { modalIDR: null, revenueIDR: null, netProfitIDR: null, diterimaIDR: null, sisaIDR: null, bookingCount: null };
  for (const row of aoa) {
    const joined = row.map((c) => String(c ?? '').trim()).join('|');
    const grabIDR = (re: RegExp) => { const m = joined.match(re); return m ? parseIDR(m[1]) : null; };
    sum.modalIDR = sum.modalIDR ?? grabIDR(/TOTAL MODAL[^0-9-]*([0-9.,-]+)/i);
    sum.revenueIDR = sum.revenueIDR ?? grabIDR(/TOTAL REVENUE[^0-9-]*([0-9.,-]+)/i);
    sum.netProfitIDR = sum.netProfitIDR ?? grabIDR(/TOTAL NET PROFIT[^0-9-]*([0-9.,-]+)/i);
    sum.diterimaIDR = sum.diterimaIDR ?? grabIDR(/TOTAL DITERIMA[^0-9-]*([0-9.,-]+)/i);
    sum.sisaIDR = sum.sisaIDR ?? grabIDR(/TOTAL SISA[^0-9-]*([0-9.,-]+)/i);
    const cm = joined.match(/Total\s*(\d+)\s*Booking/i);
    if (cm && sum.bookingCount == null) sum.bookingCount = parseInt(cm[1], 10);
  }
  return sum;
}

export interface SummaryReconciliation {
  field: string; report: number; computed: number; diff: number; ok: boolean;
}
export function reconcileReportTotals(sum: ReportSummary, bookings: MasterBooking[]): SummaryReconciliation[] {
  const out: SummaryReconciliation[] = [];
  const cmp = (field: string, report: number | null, computed: number) => {
    if (report == null) return;
    const diff = Math.round(report - computed);
    out.push({ field, report, computed: Math.round(computed), diff, ok: Math.abs(diff) <= 1 });
  };
  cmp('TOTAL MODAL (BUY)', sum.modalIDR, bookings.reduce((s, b) => s + (b.buy.totalIDRActual ?? 0), 0));
  cmp('TOTAL REVENUE (SELL)', sum.revenueIDR, bookings.reduce((s, b) => s + (b.sell.totalIDRActual ?? 0), 0));
  cmp('TOTAL NET PROFIT', sum.netProfitIDR, bookings.reduce((s, b) => s + (b.netProfitIDR ?? 0), 0));
  cmp('TOTAL DITERIMA', sum.diterimaIDR, bookings.reduce((s, b) => s + (b.sell.idrMasuk ?? 0), 0));
  cmp('TOTAL SISA', sum.sisaIDR, bookings.reduce((s, b) => s + (b.sell.sisaIDR ?? 0), 0));
  return out;
}

/* ---------------- Duplicate fingerprint ---------------- */

const normKey = (s: string | null) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export type DupClass = 'EXACT_DUPLICATE' | 'POSSIBLE_DUPLICATE' | 'NEW_RECORD';

export function classifyDuplicate(m: MasterBooking, existing: Booking[]): DupClass {
  const fp = (no: string | null, hotel: string | null, cust: string | null, ci: string | null, co: string | null, vend: string | null) =>
    [normKey(no), normKey(hotel), normKey(cust), ci || '', co || '', normKey(vend)].join('|');
  const mine = fp(m.bookingNo, m.hotel, m.customer, m.checkIn || '', m.checkOut || '', m.vendor);
  for (const e of existing) {
    const theirs = fp(e.bookingRef, e.hotelName, e.travelCompany || e.customerName, e.checkInDate, e.checkOutDate, e.vendorName || '');
    if (theirs === mine) return 'EXACT_DUPLICATE';
    const a = mine.split('|'); const t = theirs.split('|');
    const match = a.filter((v, i) => v !== '' && v === t[i]).length;
    if (match >= 4) return 'POSSIBLE_DUPLICATE';
  }
  return 'NEW_RECORD';
}

/* ---------------- Data quality score ---------------- */

export function qualityScore(m: MasterBooking): number {
  let score = 100;
  m.issues.forEach((i) => {
    if (i.level === 'ERROR' || i.level === 'CRITICAL') score -= 25;
    else if (i.level === 'WARNING') score -= 6;
  });
  if (m.checkIn && m.checkOut && m.sourceNights == null) score -= 5;
  return Math.max(0, Math.min(100, score));
}

/* ---------------- Master → Booking conversion (lossless) ---------------- */

import { Booking } from '../types/booking';

export function masterToBooking(
  m: MasterBooking,
  opts: { useCalculatedNights: boolean; fallbackRate: number }
): Booking {
  const nights = opts.useCalculatedNights && m.calcNights ? m.calcNights : (m.sourceNights ?? m.calcNights ?? 1);
  // Never infer FX from IDR/SAR ratios. Use explicit source rate, otherwise the
  // configured fallback and preserve actual IDR source values independently.
  const rate = m.exchangeRate != null && m.exchangeRate > 0 ? m.exchangeRate : opts.fallbackRate;

  const rooms = ROOM_CODES.filter((c) => (m.sell.rooms[c].qty ?? 0) > 0).map((c) => ({
    id: `r-${c}`,
    roomType: ROOM_LABELS[c],
    numberOfRooms: m.sell.rooms[c].qty ?? 0,
    costPerNight: m.buy.rooms[c].rate ?? 0,
    sellPerNight: m.sell.rooms[c].rate ?? 0,
    mealPlan: (m.sell.meal || m.buy.meal || 'Room Only') as Booking['rooms'][number]['mealPlan'],
  }));

  const paidIDR = m.sell.idrMasuk ?? 0;
  const paidSAR = Math.round((paidIDR / (rate || opts.fallbackRate)) * 100) / 100;
  const normSt = normalizeStatus(m.status);
  const status: Booking['status'] = normSt
    ? normSt === 'PAID' ? 'Paid' : normSt === 'PARTIAL' ? 'Partial' : 'Unpaid'
    : paidIDR > 0 ? 'Partial' : 'Unpaid';

  return {
    id: `imp-${Date.now()}-${m.bookingNo}`,
    bookingRef: m.bookingNo.replace('#', 'IMP-'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status,
    staffName: m.sales || 'GHOFAR',
    source: 'import',
    importSource: {
      bookingNo: m.bookingNo,
      sourceNights: m.sourceNights,
      buy: m.buy,
      sell: m.sell,
      netProfitIDR: m.netProfitIDR,
      marginPct: m.marginPct,
      currency: m.currency,
      exchangeRate: m.exchangeRate,
      notes: m.notes,
    },
    vendorName: m.vendor || undefined,
    vendorPic: m.pic || undefined,
    customerName: m.customer || '-',
    customerPhone: '', customerEmail: '', customerPassport: '', customerCountry: 'Indonesia',
    bookingType: 'Group', travelCompany: m.customer || undefined,
    groupSize: { adults: 1, children: 0, infants: 0 },
    notes: m.notes || `Master import ${m.bookingNo}${m.exchangeRate == null ? ' · Exchange rate not supplied; configured fallback used for SAR payment conversion' : ''}`,
    hotelName: m.hotel || '-',
    hotelCity: 'Makkah', starRating: 5,
    checkInDate: m.checkIn || new Date().toISOString().slice(0, 10),
    checkOutDate: m.checkOut || new Date().toISOString().slice(0, 10),
    totalNights: nights,
    inputCurrency: 'SAR', exchangeRate: rate,
    rooms,
    additionalServices: (m.sell.trans ?? 0) > 0 || (m.buy.trans ?? 0) > 0
      ? [{ id: 'tr', description: 'Transport', cost: m.buy.trans ?? 0, sell: m.sell.trans ?? 0 }]
      : [],
    totalCostSAR: m.buy.totalSAR ?? calculateBookingTotal(m.buy, nights),
    totalSellSAR: m.sell.totalSAR ?? calculateBookingTotal(m.sell, nights),
    totalCostIDR: m.buy.totalIDRActual ?? Math.round((m.buy.totalSAR ?? 0) * rate),
    totalSellIDR: m.sell.totalIDRActual ?? Math.round((m.sell.totalSAR ?? 0) * rate),
    profitSAR: Math.round(((m.sell.totalSAR ?? 0) - (m.buy.totalSAR ?? 0)) * 100) / 100,
    profitIDR: m.netProfitIDR ?? calculateProfit(m.sell.totalIDRActual, m.buy.totalIDRActual) ?? 0,
    profitMarginPercent: m.marginPct ?? calculateMargin(m.netProfitIDR, m.sell.totalIDRActual) ?? 0,
    amountPaidSAR: paidSAR, amountPaidIDR: paidIDR,
    paymentExchangeRate: rate,
    paymentMethod: 'Bank Transfer (BCA/Mandiri)',
    dueDate: m.checkIn || '',
    paymentHistory: paidIDR > 0 ? [{
      id: 'ph1', date: new Date().toISOString(), amountSAR: paidSAR, amountIDR: paidIDR,
      exchangeRate: rate, direction: 'customer', method: 'Bank Transfer (BCA/Mandiri)',
      reference: 'IMPORT', note: 'IDR Masuk (master import)',
    }] : [],
    vendorPayments: (m.buy.idrMasuk ?? 0) > 0 ? [{
      id: 'vp1', date: new Date().toISOString(),
      amountSAR: Math.round(((m.buy.idrMasuk ?? 0) / (rate || opts.fallbackRate)) * 100) / 100,
      amountIDR: m.buy.idrMasuk ?? 0, exchangeRate: rate, direction: 'vendor',
      method: 'Bank Transfer (Al Rajhi)', reference: 'IMPORT', note: `IDR Masuk vendor (${m.vendor})`,
    }] : [],
  };
}
